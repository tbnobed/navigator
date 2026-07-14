export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Bearing from a to b in floorplan space, where 0 = "floorplan up" (-y),
 * increasing clockwise (90 = right/+x, 180 = down/+y, 270 = left/-x).
 */
export function bearingDeg(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Smallest signed difference (a - b) normalized to (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
