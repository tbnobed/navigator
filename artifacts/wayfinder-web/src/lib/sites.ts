/**
 * Client-side access to admin-created sites + conversion into the runtime
 * `Building` shape the navigation code consumes.
 */
import { useQuery } from '@tanstack/react-query';
import type { Building, BuildingNode } from '@/lib/buildings';
import { buildings as staticBuildings } from '@/lib/buildings';
import type { StoredSite } from '@/lib/siteTypes';

const BASE = import.meta.env.BASE_URL; // ends with '/'
export const API_BASE = `${BASE}api`;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function uploadUrl(imageFile: string): string {
  return `${API_BASE}/uploads/${imageFile}`;
}

/** Convert a stored (pixel-based) site into a runtime Building. */
export function storedToBuilding(site: StoredSite): Building | null {
  if (!site.imageFile || !site.imageWidth || !site.imageHeight) return null;
  const mpp = site.metersPerPixel;
  const nodes: BuildingNode[] = site.nodes.map((n) => ({
    id: n.id,
    floor: 1,
    x: n.px * mpp,
    y: n.py * mpp,
    kind: n.kind,
    label: n.label,
    category: n.category,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    id: site.id,
    name: site.name,
    floors: [
      {
        level: 1,
        name: 'Floor 1',
        width: site.imageWidth * mpp,
        height: site.imageHeight * mpp,
        rooms: [],
        image: uploadUrl(site.imageFile),
      },
    ],
    nodes,
    edges: site.edges.flatMap(({ a, b }) => {
      const na = byId.get(a);
      const nb = byId.get(b);
      if (!na || !nb) return [];
      return [{ a, b, distance: Math.hypot(nb.x - na.x, nb.y - na.y) }];
    }),
    entrances: site.nodes
      .filter((n) => n.kind === 'entrance')
      .map((n) => ({
        qrValue: `WAYFINDER://${site.id}/${n.id}`,
        nodeId: n.id,
        label: n.label || 'Entrance',
        facingBearing: n.facingBearing ?? 0,
      })),
  };
}

/**
 * All buildings visible to visitors: the built-in demo + published
 * admin-created sites. Falls back to just the built-in one while loading or
 * if the API is unreachable, so the visitor app never breaks.
 */
export function useBuildings(): { buildings: Building[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['public-sites'],
    queryFn: () => api<{ sites: StoredSite[] }>('/sites'),
    staleTime: 30_000,
    retry: 1,
  });
  const dynamic = (query.data?.sites ?? [])
    .map(storedToBuilding)
    .filter((b): b is Building => b !== null);
  return { buildings: [...staticBuildings, ...dynamic], isLoading: query.isLoading };
}

export function getBuildingIn(list: Building[], id: string | null | undefined): Building | undefined {
  if (!id) return undefined;
  return list.find((b) => b.id === id);
}

export function findEntranceIn(
  list: Building[],
  qrValue: string,
): { building: Building; entrance: Building['entrances'][number] } | null {
  for (const building of list) {
    const entrance = building.entrances.find((e) => e.qrValue === qrValue);
    if (entrance) return { building, entrance };
  }
  return null;
}
