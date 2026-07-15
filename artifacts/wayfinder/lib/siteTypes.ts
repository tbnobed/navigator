/**
 * Shared shape of an admin-created site as stored on the server.
 * Mirrors artifacts/wayfinder-web/src/lib/siteTypes.ts (types only).
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
  posterTitle?: string;
  posterLogoFile?: string | null;
  posterAccentColor?: string;
  createdAt: string;
  updatedAt: string;
}
