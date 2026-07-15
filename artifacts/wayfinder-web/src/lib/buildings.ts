/**
 * Static indoor-map data, built from the real first-floor plan of the
 * broadcast studio building (attached floor-plan image).
 *
 * Node coordinates were traced from the floor-plan image in pixels, then
 * converted to meters with a fixed scale so distances, step counting and
 * routing all work in real-world units.
 */


export type NodeKind = 'entrance' | 'junction' | 'poi' | 'vertical';

export interface BuildingNode {
  id: string;
  floor: number;
  x: number;
  y: number;
  kind: NodeKind;
  label?: string;
  category?: string;
}

export interface BuildingEdge {
  a: string;
  b: string;
  /** Walking-equivalent distance in meters, used both as routing weight and display distance. */
  distance: number;
  floorChange?: { mode: 'elevator' | 'stairs' };
}

export interface BuildingRoom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface BuildingFloor {
  level: number;
  name: string;
  width: number;
  height: number;
  rooms: BuildingRoom[];
  /** Optional real floor-plan image drawn as the map background (spans the full floor extent). */
  image?: string;
}

export interface BuildingEntrance {
  qrValue: string;
  nodeId: string;
  label: string;
  /** Floorplan bearing (0-360, 0 = "up") a visitor faces once through this entrance. Used to calibrate compass. */
  facingBearing: number;
}

export interface Building {
  id: string;
  name: string;
  floors: BuildingFloor[];
  nodes: BuildingNode[];
  edges: BuildingEdge[];
  entrances: BuildingEntrance[];
}

/** Meters per floor-plan-image pixel (building main corridor ≈ 74 m end-to-end). */
const METERS_PER_PIXEL = 0.08;
/** Floor-plan image dimensions in pixels. */
const IMAGE_W = 1024;
const IMAGE_H = 722;

/** Node positions traced from the floor-plan image, in image pixels. */
const rawNodes: {
  id: string;
  px: number;
  py: number;
  kind: NodeKind;
  label?: string;
  category?: string;
}[] = [
  // QR starting points (red circles on the plan)
  { id: 'entrance_lobby', px: 308, py: 578, kind: 'entrance', label: 'Lobby Entrance' },
  { id: 'entrance_clobby', px: 952, py: 543, kind: 'entrance', label: 'C-Lobby Entrance' },

  // Main east-west corridor (blue)
  { id: 'j_west', px: 60, py: 600, kind: 'junction' },
  { id: 'j_tech1', px: 115, py: 600, kind: 'junction' },
  { id: 'j_ctrl', px: 232, py: 600, kind: 'junction' },
  { id: 'j_lobby_s', px: 310, py: 598, kind: 'junction' },
  { id: 'j_lobby', px: 345, py: 570, kind: 'junction' },
  { id: 'j_master', px: 460, py: 558, kind: 'junction' },
  { id: 'j_mid', px: 570, py: 555, kind: 'junction' },
  { id: 'j_tech2', px: 660, py: 558, kind: 'junction' },
  { id: 'j_it', px: 770, py: 558, kind: 'junction' },
  { id: 'j_break', px: 875, py: 550, kind: 'junction' },

  // West branches up to Studios A & B
  { id: 't_tech1', px: 115, py: 495, kind: 'junction' },
  { id: 't_ctrl', px: 232, py: 490, kind: 'junction' },
  { id: 'studio_b', px: 115, py: 460, kind: 'poi', label: 'Studio B', category: 'Studio' },
  { id: 'studio_a', px: 240, py: 470, kind: 'poi', label: 'Studio A', category: 'Studio' },

  // North corridor along the west side of Studio C (blue vertical path)
  { id: 'n1', px: 600, py: 520, kind: 'junction' },
  { id: 'n2', px: 597, py: 455, kind: 'junction' },
  { id: 'n3', px: 593, py: 390, kind: 'junction' },
  { id: 'n4', px: 590, py: 320, kind: 'junction' },
  { id: 'n5', px: 588, py: 250, kind: 'junction' },
  { id: 'n6', px: 585, py: 190, kind: 'junction' },
  { id: 'studio_c', px: 630, py: 310, kind: 'poi', label: 'Studio C', category: 'Studio' },
  { id: 'studio_d', px: 645, py: 160, kind: 'poi', label: 'Studio D', category: 'Studio' },

  // East corridor up past Break Room / Make-up toward Studio D
  { id: 'e1', px: 848, py: 330, kind: 'junction' },
  { id: 'e2', px: 843, py: 250, kind: 'junction' },
  { id: 'e3', px: 838, py: 185, kind: 'junction' },
];

/** Walkable connections along the blue hallways. */
const rawEdges: [string, string][] = [
  ['j_west', 'j_tech1'],
  ['j_tech1', 'j_ctrl'],
  ['j_ctrl', 'j_lobby_s'],
  ['j_lobby_s', 'entrance_lobby'],
  ['entrance_lobby', 'j_lobby'],
  ['j_lobby', 'j_master'],
  ['j_master', 'j_mid'],
  ['j_mid', 'j_tech2'],
  ['j_tech2', 'j_it'],
  ['j_it', 'j_break'],
  ['j_break', 'entrance_clobby'],

  ['j_tech1', 't_tech1'],
  ['t_tech1', 'studio_b'],
  ['j_ctrl', 't_ctrl'],
  ['t_ctrl', 'studio_a'],

  ['j_mid', 'n1'],
  ['n1', 'n2'],
  ['n2', 'n3'],
  ['n3', 'n4'],
  ['n4', 'n5'],
  ['n5', 'n6'],
  ['n4', 'studio_c'],
  ['n6', 'studio_d'],

  ['j_break', 'e1'],
  ['e1', 'e2'],
  ['e2', 'e3'],
  ['e3', 'studio_d'],
];

const nodes: BuildingNode[] = rawNodes.map((n) => ({
  id: n.id,
  floor: 1,
  x: n.px * METERS_PER_PIXEL,
  y: n.py * METERS_PER_PIXEL,
  kind: n.kind,
  label: n.label,
  category: n.category,
}));

const nodeById = new Map(nodes.map((n) => [n.id, n]));

const edges: BuildingEdge[] = rawEdges.map(([a, b]) => {
  const na = nodeById.get(a);
  const nb = nodeById.get(b);
  if (!na || !nb) throw new Error(`Unknown node in edge ${a}-${b}`);
  return { a, b, distance: Math.hypot(nb.x - na.x, nb.y - na.y) };
});

export const buildings: Building[] = [
  {
    id: 'studios',
    name: 'Broadcast Studios — Floor 1',
    floors: [
      {
        level: 1,
        name: 'Floor 1',
        width: IMAGE_W * METERS_PER_PIXEL,
        height: IMAGE_H * METERS_PER_PIXEL,
        rooms: [],
        image: `${import.meta.env.BASE_URL}floorplan.png`,
      },
    ],
    nodes,
    edges,
    entrances: [
      {
        qrValue: 'INDOORA://studios/lobby',
        nodeId: 'entrance_lobby',
        label: 'Lobby Entrance',
        facingBearing: 0,
      },
      {
        qrValue: 'INDOORA://studios/c-lobby',
        nodeId: 'entrance_clobby',
        label: 'C-Lobby Entrance',
        facingBearing: 270,
      },
    ],
  },
];

export function getBuilding(id: string | undefined | null): Building | undefined {
  if (!id) return undefined;
  return buildings.find((b) => b.id === id);
}

export function getNode(building: Building, nodeId: string): BuildingNode | undefined {
  return building.nodes.find((n) => n.id === nodeId);
}

export function getPois(building: Building): BuildingNode[] {
  return building.nodes.filter((n) => n.kind === 'poi');
}

export function findEntranceByQr(
  qrValue: string,
): { building: Building; entrance: BuildingEntrance } | null {
  for (const building of buildings) {
    const entrance = building.entrances.find((e) => e.qrValue === qrValue);
    if (entrance) return { building, entrance };
  }
  return null;
}
