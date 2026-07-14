/**
 * Static indoor-map data for the demo "Meridian Campus" office building.
 *
 * Coordinates are in meters on a per-floor 2D plane. This stands in for real
 * floor-plan/BIM data that a production app would load per building.
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

export const buildings: Building[] = [
  {
    id: 'campus-a',
    name: 'Meridian Campus — Building A',
    floors: [
      {
        level: 1,
        name: 'Ground Floor',
        width: 40,
        height: 32,
        rooms: [
          { id: 'lobby_room', x: 12, y: 21, width: 16, height: 9, label: 'Lobby' },
          { id: 'conf_a_room', x: 2, y: 15, width: 8, height: 6, label: 'Conference Room A' },
          { id: 'restroom_1a_room', x: 2, y: 10, width: 8, height: 4, label: 'Restrooms' },
          { id: 'cafeteria_room', x: 27, y: 19, width: 11, height: 8, label: 'Cafeteria' },
          { id: 'conf_b_room', x: 29, y: 15, width: 9, height: 6, label: 'Conference Room B' },
          { id: 'core_room_1', x: 16, y: 6, width: 14, height: 6, label: 'Elevator / Stairs' },
          { id: 'dock_room', x: 0, y: 13, width: 8, height: 6, label: 'Loading Dock' },
        ],
      },
      {
        level: 2,
        name: 'Level 2',
        width: 40,
        height: 32,
        rooms: [
          { id: 'conf_c_room', x: 2, y: 15, width: 9, height: 6, label: 'Conference Room C' },
          { id: 'conf_d_room', x: 28, y: 15, width: 9, height: 6, label: 'Conference Room D' },
          { id: 'open_offices_room', x: 10, y: 21, width: 20, height: 9, label: 'Open Offices' },
          { id: 'restroom_2a_room', x: 26, y: 6, width: 8, height: 5, label: 'Restrooms' },
          { id: 'core_room_2', x: 16, y: 6, width: 9, height: 6, label: 'Elevator / Stairs' },
        ],
      },
    ],
    nodes: [
      { id: 'entrance_main', floor: 1, x: 20, y: 29, kind: 'entrance', label: 'Main Entrance' },
      { id: 'entrance_dock', floor: 1, x: 4, y: 16, kind: 'entrance', label: 'Loading Dock' },
      { id: 'lobby', floor: 1, x: 20, y: 25, kind: 'junction' },
      { id: 'reception', floor: 1, x: 16, y: 25, kind: 'poi', label: 'Reception', category: 'Services' },
      { id: 'corridor_mid', floor: 1, x: 20, y: 18, kind: 'junction' },
      { id: 'corridor_west', floor: 1, x: 10, y: 18, kind: 'junction' },
      { id: 'corridor_east', floor: 1, x: 30, y: 18, kind: 'junction' },
      { id: 'corridor_north', floor: 1, x: 20, y: 10, kind: 'junction' },
      { id: 'elevator_1', floor: 1, x: 20, y: 14, kind: 'vertical', label: 'Elevator' },
      { id: 'stairs_1', floor: 1, x: 26, y: 10, kind: 'vertical', label: 'Stairs' },
      { id: 'conf_a', floor: 1, x: 6, y: 18, kind: 'poi', label: 'Conference Room A', category: 'Meeting Room' },
      { id: 'restroom_1a', floor: 1, x: 10, y: 13, kind: 'poi', label: 'Restrooms', category: 'Restroom' },
      { id: 'cafeteria', floor: 1, x: 32, y: 22, kind: 'poi', label: 'Cafeteria', category: 'Food & Drink' },
      { id: 'conf_b', floor: 1, x: 34, y: 18, kind: 'poi', label: 'Conference Room B', category: 'Meeting Room' },

      { id: 'elevator_2', floor: 2, x: 20, y: 14, kind: 'vertical', label: 'Elevator' },
      { id: 'stairs_2', floor: 2, x: 26, y: 10, kind: 'vertical', label: 'Stairs' },
      { id: 'corridor_2north', floor: 2, x: 20, y: 10, kind: 'junction' },
      { id: 'corridor_2mid', floor: 2, x: 20, y: 18, kind: 'junction' },
      { id: 'conf_c', floor: 2, x: 8, y: 18, kind: 'poi', label: 'Conference Room C', category: 'Meeting Room' },
      { id: 'conf_d', floor: 2, x: 32, y: 18, kind: 'poi', label: 'Conference Room D', category: 'Meeting Room' },
      { id: 'open_offices', floor: 2, x: 20, y: 25, kind: 'poi', label: 'Open Offices', category: 'Workspace' },
      { id: 'restroom_2a', floor: 2, x: 30, y: 10, kind: 'poi', label: 'Restrooms', category: 'Restroom' },
    ],
    edges: [
      { a: 'entrance_main', b: 'lobby', distance: 4 },
      { a: 'lobby', b: 'reception', distance: 4 },
      { a: 'lobby', b: 'corridor_mid', distance: 7 },
      { a: 'corridor_mid', b: 'corridor_west', distance: 10 },
      { a: 'corridor_mid', b: 'corridor_east', distance: 10 },
      { a: 'corridor_mid', b: 'corridor_north', distance: 8 },
      { a: 'corridor_west', b: 'conf_a', distance: 5 },
      { a: 'corridor_west', b: 'restroom_1a', distance: 5 },
      { a: 'corridor_west', b: 'entrance_dock', distance: 7 },
      { a: 'corridor_east', b: 'cafeteria', distance: 5 },
      { a: 'corridor_east', b: 'conf_b', distance: 5 },
      { a: 'corridor_north', b: 'elevator_1', distance: 4 },
      { a: 'corridor_north', b: 'stairs_1', distance: 6 },

      { a: 'corridor_2north', b: 'elevator_2', distance: 4 },
      { a: 'corridor_2north', b: 'stairs_2', distance: 6 },
      { a: 'corridor_2north', b: 'corridor_2mid', distance: 8 },
      { a: 'corridor_2mid', b: 'conf_c', distance: 10 },
      { a: 'corridor_2mid', b: 'conf_d', distance: 10 },
      { a: 'corridor_2mid', b: 'open_offices', distance: 7 },
      { a: 'corridor_2north', b: 'restroom_2a', distance: 6 },

      { a: 'elevator_1', b: 'elevator_2', distance: 15, floorChange: { mode: 'elevator' } },
      { a: 'stairs_1', b: 'stairs_2', distance: 10, floorChange: { mode: 'stairs' } },
    ],
    entrances: [
      { qrValue: 'WAYFINDER://campus-a/main-entrance', nodeId: 'entrance_main', label: 'Main Entrance', facingBearing: 0 },
      { qrValue: 'WAYFINDER://campus-a/loading-dock', nodeId: 'entrance_dock', label: 'Loading Dock', facingBearing: 108 },
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
