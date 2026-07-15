import type { Building, BuildingEdge } from '@/lib/buildings';
import { angleDiff, bearingDeg, distance } from '@/lib/geometry';

export interface RoutePoint {
  nodeId: string;
  x: number;
  y: number;
  floor: number;
  label?: string;
}

export interface RouteLeg {
  floor: number;
  points: RoutePoint[];
  totalDistance: number;
  transition?: { mode: 'elevator' | 'stairs'; toFloor: number };
}

export interface RouteStep {
  legIndex: number;
  fromIndex: number;
  instruction: string;
  distance: number;
  bearing: number;
}

export interface Route {
  legs: RouteLeg[];
  totalDistance: number;
  steps: RouteStep[];
}

function buildAdjacency(building: Building) {
  const map = new Map<string, { to: string; edge: BuildingEdge }[]>();
  for (const n of building.nodes) map.set(n.id, []);
  for (const e of building.edges) {
    map.get(e.a)?.push({ to: e.b, edge: e });
    map.get(e.b)?.push({ to: e.a, edge: e });
  }
  return map;
}

/** Plain Dijkstra shortest path — the graphs here are small enough that an O(n^2) scan is fine. */
export function findShortestPath(
  building: Building,
  startId: string,
  endId: string,
): { nodeIds: string[]; edges: BuildingEdge[] } | null {
  const adjacency = buildAdjacency(building);
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: BuildingEdge }>();
  const visited = new Set<string>();
  for (const n of building.nodes) dist.set(n.id, Infinity);
  if (!dist.has(startId) || !dist.has(endId)) return null;
  dist.set(startId, 0);

  for (;;) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        current = id;
        currentDist = d;
      }
    }
    if (current === null || current === endId) break;
    visited.add(current);
    for (const { to, edge } of adjacency.get(current) ?? []) {
      if (visited.has(to)) continue;
      const alt = currentDist + edge.distance;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, { node: current, edge });
      }
    }
  }

  if (startId !== endId && !prev.has(endId)) return null;

  const nodeIds: string[] = [endId];
  const edges: BuildingEdge[] = [];
  let cursor = endId;
  while (cursor !== startId) {
    const step = prev.get(cursor);
    if (!step) return null;
    edges.unshift(step.edge);
    nodeIds.unshift(step.node);
    cursor = step.node;
  }
  return { nodeIds, edges };
}

function legDistanceOf(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += distance(points[i], points[i + 1]);
  return total;
}

function turnInstruction(diff: number): string {
  const abs = Math.abs(diff);
  if (abs < 20) return 'Continue straight';
  if (abs < 100) return diff > 0 ? 'Turn right' : 'Turn left';
  return diff > 0 ? 'Turn sharply right' : 'Turn sharply left';
}

/** Splits a raw node path into per-floor legs (split at elevator/stairs edges) with turn-by-turn steps. */
export function buildRoute(building: Building, nodeIds: string[], edges: BuildingEdge[]): Route {
  const nodeById = new Map(building.nodes.map((n) => [n.id, n]));
  const legs: RouteLeg[] = [];
  let currentPoints: RoutePoint[] = [];
  let currentFloor = nodeById.get(nodeIds[0])!.floor;

  const pushPoint = (id: string) => {
    const n = nodeById.get(id)!;
    currentPoints.push({ nodeId: n.id, x: n.x, y: n.y, floor: n.floor, label: n.label });
  };

  pushPoint(nodeIds[0]);

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const toId = nodeIds[i + 1];
    if (edge.floorChange) {
      legs.push({
        floor: currentFloor,
        points: currentPoints,
        totalDistance: legDistanceOf(currentPoints),
        transition: { mode: edge.floorChange.mode, toFloor: nodeById.get(toId)!.floor },
      });
      currentFloor = nodeById.get(toId)!.floor;
      currentPoints = [];
      pushPoint(toId);
    } else {
      pushPoint(toId);
    }
  }
  legs.push({ floor: currentFloor, points: currentPoints, totalDistance: legDistanceOf(currentPoints) });

  const steps: RouteStep[] = [];
  legs.forEach((leg, legIndex) => {
    for (let i = 0; i < leg.points.length - 1; i++) {
      const from = leg.points[i];
      const to = leg.points[i + 1];
      const bearing = bearingDeg(from, to);
      let instruction: string;
      if (i === 0) {
        instruction = legIndex === 0 ? 'Head toward your destination' : 'Continue toward your destination';
      } else {
        const prevBearing = bearingDeg(leg.points[i - 1], from);
        instruction = turnInstruction(angleDiff(bearing, prevBearing));
      }
      steps.push({ legIndex, fromIndex: i, instruction, distance: distance(from, to), bearing });
    }
    if (leg.transition) {
      steps.push({
        legIndex,
        fromIndex: leg.points.length - 1,
        instruction:
          leg.transition.mode === 'elevator'
            ? `Take the elevator to Floor ${leg.transition.toFloor}`
            : `Take the stairs to Floor ${leg.transition.toFloor}`,
        distance: 0,
        bearing: 0,
      });
    }
  });
  steps.push({
    legIndex: legs.length - 1,
    fromIndex: Math.max(legs[legs.length - 1].points.length - 1, 0),
    instruction: "You've arrived",
    distance: 0,
    bearing: 0,
  });

  const totalDistance = legs.reduce((sum, l) => sum + l.totalDistance, 0);
  return { legs, totalDistance, steps };
}
