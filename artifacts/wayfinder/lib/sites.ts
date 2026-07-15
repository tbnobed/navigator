/**
 * Client-side access to admin-created sites + conversion into the runtime
 * `Building` shape the navigation code consumes.
 *
 * Mirrors artifacts/wayfinder-web/src/lib/sites.ts.
 */
import { useQuery } from '@tanstack/react-query';
import type { Building, BuildingNode } from '@/constants/buildings';
import { buildings as staticBuildings } from '@/constants/buildings';
import { api, uploadUrl } from '@/lib/api';
import type { StoredSite } from '@/lib/siteTypes';

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
        image: { uri: uploadUrl(site.imageFile) },
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
        qrValue: `INDOORA://${site.id}/${n.id}`,
        nodeId: n.id,
        label: n.label || 'Entrance',
        facingBearing: n.facingBearing ?? 0,
      })),
  };
}

/**
 * All buildings visible to visitors: published admin-created sites.
 *
 * The built-in sample building is DEV-ONLY — it is compiled out of
 * production builds entirely (guarded by __DEV__) so demo data can never
 * surface, or shadow a real site with the same id, on a live server.
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
  // Admin sites always take priority; demos (dev only) never shadow them.
  const demos = __DEV__
    ? staticBuildings.filter((s) => !dynamic.some((d) => d.id === s.id))
    : [];
  return { buildings: [...dynamic, ...demos], isLoading: query.isLoading };
}

export function getBuildingIn(
  list: Building[],
  id: string | null | undefined,
): Building | undefined {
  if (!id) return undefined;
  return list.find((b) => b.id === id);
}

/**
 * Resolve an `INDOORA://building/node` code where the node can be ANY node
 * (entrance or destination) — used by room-level QR posters so a guest can
 * start a journey from e.g. Studio C's door.
 */
export function findStartIn(
  list: Building[],
  qrValue: string,
): { building: Building; nodeId: string } | null {
  const m = /^INDOORA:\/\/([^/]+)\/(.+)$/i.exec(qrValue.trim());
  if (!m) return null;
  const building = list.find((b) => b.id.toLowerCase() === m[1].toLowerCase());
  if (!building) return null;
  const node = building.nodes.find((n) => n.id.toLowerCase() === m[2].toLowerCase());
  if (!node) return null;
  return { building, nodeId: node.id };
}

export function findEntranceIn(
  list: Building[],
  qrValue: string,
): { building: Building; entrance: Building['entrances'][number] } | null {
  const wanted = qrValue.trim().toLowerCase();
  for (const building of list) {
    const entrance = building.entrances.find((e) => e.qrValue.toLowerCase() === wanted);
    if (entrance) return { building, entrance };
  }
  return null;
}
