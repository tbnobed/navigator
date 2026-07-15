/**
 * Shared shape of an admin-created site as stored on the server.
 * Pure types + validation only — imported by both the frontend and the
 * Express server (so keep it free of vite/browser globals).
 */

export type StoredNodeKind = 'entrance' | 'junction' | 'poi';

export interface StoredSiteNode {
  id: string;
  /** Position in floor-plan image pixels. */
  px: number;
  py: number;
  kind: StoredNodeKind;
  label?: string;
  category?: string;
  /** Entrances only: floorplan bearing (0-360, 0 = "up") a visitor faces walking in. */
  facingBearing?: number;
}

export interface StoredSiteEdge {
  a: string;
  b: string;
}

export interface StoredSite {
  /** URL-safe id, also the site code visitors can type. */
  id: string;
  name: string;
  /** Uploaded floor-plan file name (in the server uploads dir), or null before upload. */
  imageFile: string | null;
  imageWidth: number;
  imageHeight: number;
  /** Real-world scale of the floor-plan image. */
  metersPerPixel: number;
  nodes: StoredSiteNode[];
  edges: StoredSiteEdge[];
  /** Only published sites are visible to visitors. */
  published: boolean;
  /** Optional poster branding — title shown on printed QR posters (falls back to "Indoora"). */
  posterTitle?: string;
  /** Optional uploaded logo file name (in the server uploads dir) shown on posters. */
  posterLogoFile?: string | null;
  /** Optional accent color (hex) for the poster title and QR code. */
  posterAccentColor?: string;
  createdAt: string;
  updatedAt: string;
}

/** Basic structural validation for a site document sent to the server. */
export function validateStoredSite(s: unknown): s is StoredSite {
  if (!s || typeof s !== 'object') return false;
  const site = s as Record<string, unknown>;
  if (typeof site.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(site.id)) return false;
  if (typeof site.name !== 'string' || !site.name.trim()) return false;
  if (site.imageFile !== null && typeof site.imageFile !== 'string') return false;
  if (typeof site.imageWidth !== 'number' || typeof site.imageHeight !== 'number') return false;
  if (typeof site.metersPerPixel !== 'number' || !(site.metersPerPixel > 0)) return false;
  if (!Array.isArray(site.nodes) || !Array.isArray(site.edges)) return false;
  const ids = new Set<string>();
  for (const n of site.nodes as StoredSiteNode[]) {
    if (typeof n?.id !== 'string' || ids.has(n.id)) return false;
    if (typeof n.px !== 'number' || typeof n.py !== 'number') return false;
    if (n.kind !== 'entrance' && n.kind !== 'junction' && n.kind !== 'poi') return false;
    ids.add(n.id);
  }
  for (const e of site.edges as StoredSiteEdge[]) {
    if (!ids.has(e?.a) || !ids.has(e?.b) || e.a === e.b) return false;
  }
  if (typeof site.published !== 'boolean') return false;
  if (site.posterTitle !== undefined && typeof site.posterTitle !== 'string') return false;
  if (
    site.posterLogoFile !== undefined &&
    site.posterLogoFile !== null &&
    typeof site.posterLogoFile !== 'string'
  )
    return false;
  if (site.posterAccentColor !== undefined) {
    if (
      typeof site.posterAccentColor !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(site.posterAccentColor)
    )
      return false;
  }
  return true;
}

/** True when a site has everything visitors need for navigation. */
export function siteIsNavigable(site: StoredSite): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!site.imageFile) problems.push('No floor-plan image uploaded.');
  const entrances = site.nodes.filter((n) => n.kind === 'entrance');
  const pois = site.nodes.filter((n) => n.kind === 'poi');
  if (entrances.length === 0) problems.push('Add at least one entrance.');
  if (pois.length === 0) problems.push('Add at least one destination.');
  for (const p of pois) {
    if (!p.label?.trim()) problems.push(`Destination "${p.id}" needs a label.`);
  }

  // Connectivity: every entrance must reach every destination.
  const adj = new Map<string, string[]>();
  for (const n of site.nodes) adj.set(n.id, []);
  for (const e of site.edges) {
    adj.get(e.a)?.push(e.b);
    adj.get(e.b)?.push(e.a);
  }
  for (const ent of entrances) {
    const seen = new Set<string>([ent.id]);
    const queue = [ent.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    for (const p of pois) {
      if (!seen.has(p.id)) {
        problems.push(`No walkable path from "${ent.label || ent.id}" to "${p.label || p.id}". Connect them with paths.`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
