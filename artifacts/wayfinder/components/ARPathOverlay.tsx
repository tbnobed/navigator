import { useMemo } from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

interface Props {
  /** Upcoming route points in floorplan meters, starting at the user's position. */
  points: { x: number; y: number }[];
  /** User position in floorplan meters (equals points[0]). */
  userX: number;
  userY: number;
  /** Direction the user faces, in floorplan bearing degrees. */
  facingBearing: number;
  width: number;
  height: number;
}

/** Assumed phone camera height above the floor (m). */
const CAMERA_HEIGHT = 1.4;
/** How far ahead the drawn path extends (m). */
const MAX_AHEAD = 18;
/** Densify the polyline so the perspective curve looks smooth. */
const SEGMENT_STEP = 0.6;

/**
 * Draws the upcoming route as a line "painted on the floor" of the camera
 * view, using a simple ground-plane perspective projection (camera assumed
 * roughly level at chest height). A prototype approximation of AR ground
 * anchoring — no world tracking involved.
 */
export function ARPathOverlay({ points, userX, userY, facingBearing, width, height }: Props) {
  const colors = useColors();

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

    // Pinhole ground projection: things further forward appear higher and smaller.
    const focal = height * 0.9;
    const horizonY = height * 0.42;
    const cx = width / 2;
    // Discard points behind (or nearly at) the camera plane instead of
    // clamping them into view — clamped behind-camera points would draw a
    // false floor trace pointing the wrong way. Keep only the first
    // contiguous in-front run so the drawn path stays continuous.
    const NEAR_PLANE = 0.8;
    const result: { x: number; y: number }[] = [];
    let started = false;
    for (const p of dense) {
      if (p.forward < NEAR_PLANE) {
        if (started) break; // path went behind the camera — stop the trace
        continue; // skip leading behind-camera points (e.g. facing away at start)
      }
      started = true;
      const x = cx + (p.right / p.forward) * focal * 0.9;
      const y = horizonY + (CAMERA_HEIGHT / p.forward) * focal;
      if (y > height + 60 || y < horizonY - 10) continue;
      result.push({ x, y });
    }
    return result;
  }, [points, userX, userY, facingBearing, width, height]);

  if (projected.length < 2) return null;

  const pointsAttr = projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const nearest = projected[projected.length - 1];

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
      <Polyline
        points={pointsAttr}
        fill="none"
        stroke={colors.accent}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <Polyline
        points={pointsAttr}
        fill="none"
        stroke={colors.accent}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      <Circle cx={nearest.x} cy={nearest.y} r={7} fill={colors.accent} opacity={0.9} />
    </Svg>
  );
}
