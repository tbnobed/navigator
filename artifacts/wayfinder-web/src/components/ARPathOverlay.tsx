import { useMemo } from 'react';

interface Props {
  /** Upcoming route points in floorplan meters, starting at the user's position. */
  points: { x: number; y: number }[];
  /** User position in floorplan meters (equals points[0]). */
  userX: number;
  userY: number;
  /** Direction the user faces, in floorplan bearing degrees. */
  facingBearing: number;
  /**
   * Phone front-back tilt (deviceorientation beta, degrees):
   * ~90 = held upright looking straight ahead, smaller = tilted down at floor.
   * Null when unavailable — falls back to a fixed "held upright" assumption.
   */
  devicePitch?: number | null;
  width: number;
  height: number;
  /** Stroke color for the floor line. */
  color?: string;
}

/** Assumed phone camera height above the floor (m). */
const CAMERA_HEIGHT = 1.4;
/** How far ahead the drawn path extends (m). */
const MAX_AHEAD = 18;
/** Densify the polyline so the perspective curve looks smooth. */
const SEGMENT_STEP = 0.6;
/** Path width on the floor (m) — rendered with perspective (wide near, thin far). */
const PATH_WIDTH_M = 0.5;

/**
 * Draws the upcoming route as a line "painted on the floor" over the camera
 * view, using a ground-plane perspective projection. The horizon follows the
 * phone's real tilt (deviceorientation beta), so tilting the phone down at
 * the floor slides the path down the screen exactly like real AR ground
 * anchoring would — without this, the path looked like a small flat map
 * floating mid-screen. Segment thickness also scales with distance
 * (wide near your feet, thin far away) to sell the floor-plane illusion.
 */
export function ARPathOverlay({
  points,
  userX,
  userY,
  facingBearing,
  devicePitch = null,
  width,
  height,
  color = '#FF9F1C',
}: Props) {
  const projected = useMemo(() => {
    if (points.length < 2) return [];

    // Convert floorplan points into user-relative (forward, right) meters.
    const rad = (facingBearing * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const relative = points.map((p) => {
      const dx = p.x - userX;
      const dy = p.y - userY;
      // Floorplan: bearing 0 = -y. Forward axis = (sin, -cos), right axis = (cos, sin).
      return { forward: dx * sin - dy * cos, right: dx * cos + dy * sin };
    });

    // Densify segments so the projected curve bends smoothly.
    const dense: { forward: number; right: number }[] = [];
    let travelled = 0;
    outer: for (let i = 0; i < relative.length - 1; i++) {
      const a = relative[i];
      const b = relative[i + 1];
      const segLen = Math.hypot(b.forward - a.forward, b.right - a.right);
      const steps = Math.max(Math.ceil(segLen / SEGMENT_STEP), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        dense.push({
          forward: a.forward + (b.forward - a.forward) * t,
          right: a.right + (b.right - a.right) * t,
        });
        if (s > 0) travelled += segLen / steps;
        if (travelled > MAX_AHEAD) break outer;
      }
    }

    const focal = height * 0.9;
    // Camera pitch below horizontal (radians). beta ≈ 90 means the phone is
    // upright looking straight ahead (pitch 0); tilting toward the floor
    // lowers beta. Clamp so extreme poses stay sane.
    const betaDeg = devicePitch ?? 75; // default: slight natural downward tilt
    // Clamp the usable pitch range: past ~50° downward (or ~30° upward) we
    // hold the projection at the limit instead of following the phone, so the
    // path slides off-screen gracefully rather than vanishing entirely when
    // someone points the camera at their feet or the ceiling.
    const pitchDown = Math.min(Math.max(((90 - betaDeg) * Math.PI) / 180, -0.5), 0.9);
    const cosP = Math.cos(pitchDown);
    const sinP = Math.sin(pitchDown);
    const cx = width / 2;
    const cy = height / 2;
    // Discard points behind (or nearly at) the camera plane instead of
    // clamping them into view — clamped behind-camera points would draw a
    // false floor trace pointing the wrong way. Keep only the first
    // contiguous in-front run so the drawn path stays continuous.
    const NEAR_PLANE = 0.5;
    const result: { x: number; y: number; forward: number }[] = [];
    let started = false;
    for (const p of dense) {
      // Rotate the camera around its horizontal axis by the pitch: a floor
      // point at (forward, -CAMERA_HEIGHT) in level-camera space becomes
      // (depth, vertical) in the tilted camera's frame.
      const depth = p.forward * cosP - CAMERA_HEIGHT * sinP;
      const vertical = -CAMERA_HEIGHT * cosP - p.forward * sinP; // negative = below view center
      if (depth < NEAR_PLANE) {
        if (started) break; // path went behind the camera — stop the trace
        continue; // skip leading behind-camera points (e.g. facing away at start)
      }
      started = true;
      // Same focal length on both axes — mismatched x/y focals squash the
      // path horizontally and make it read as a shrunken map, not floor paint.
      const x = cx + (p.right / depth) * focal;
      const y = cy - (vertical / depth) * focal;
      if (y > height + 120 || y < -60 || x < -width || x > width * 2) continue;
      result.push({ x, y, forward: p.forward });
    }
    return result;
  }, [points, userX, userY, facingBearing, devicePitch, width, height]);

  if (projected.length < 2) return null;

  const focal = height * 0.9;
  // Per-segment strokes with perspective width: wide near the feet, thin far
  // away. A constant-width polyline reads as a flat map, not floor paint.
  const widthAt = (forward: number) =>
    Math.min(Math.max((PATH_WIDTH_M / Math.max(forward, 0.6)) * focal, 3), 46);

  const segments = projected.slice(0, -1).map((a, i) => {
    const b = projected[i + 1];
    return { a, b, w: (widthAt(a.forward) + widthAt(b.forward)) / 2 };
  });
  const nearest = projected[0];

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {segments.map((s, i) => (
        <line
          key={`glow-${i}`}
          x1={s.a.x}
          y1={s.a.y}
          x2={s.b.x}
          y2={s.b.y}
          stroke={color}
          strokeWidth={s.w * 1.8}
          strokeLinecap="round"
          opacity={0.3}
        />
      ))}
      {segments.map((s, i) => (
        <line
          key={`core-${i}`}
          x1={s.a.x}
          y1={s.a.y}
          x2={s.b.x}
          y2={s.b.y}
          stroke={color}
          strokeWidth={s.w}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
      <circle
        cx={nearest.x}
        cy={nearest.y}
        r={Math.min(widthAt(nearest.forward) * 0.7, 18)}
        fill={color}
        opacity={0.9}
      />
    </svg>
  );
}
