import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

interface Props {
  /** Upcoming route points in floorplan meters, starting at the user's position. */
  points: { x: number; y: number }[];
  /** User position in floorplan meters (equals points[0]). */
  userX: number;
  userY: number;
  /** Direction the user faces, in floorplan bearing degrees. */
  facingBearing: number;
  /**
   * Phone front-back tilt (degrees): ~90 = held upright looking straight
   * ahead, smaller = tilted down at floor. Null when unavailable — falls
   * back to a natural holding-angle assumption.
   */
  devicePitch?: number | null;
  width: number;
  height: number;
}

/** Assumed phone camera height above the floor (m). */
const CAMERA_HEIGHT = 1.4;
/** How far ahead the drawn path extends (m). */
const MAX_AHEAD = 18;
/** Densify the polyline so the perspective curve looks smooth. */
const SEGMENT_STEP = 0.6;
/** Half-width of the painted floor band (m) — total band ≈ 1.2m wide. */
const PATH_HALF_W = 0.6;
/** Distance between the animated floor chevrons (m). */
const CHEVRON_SPACING = 2.4;
/** Chevron size on the floor (m): length of each wing / half-width. */
const CHEVRON_LEN = 0.55;
const CHEVRON_HALF_W = 0.42;
/** Chevron drift speed along the path (m/s). */
const CHEVRON_SPEED = 1.1;
/** Animation tick (ms). Kept coarse to limit re-renders. */
const TICK_MS = 80;

/**
 * Draws the upcoming route as a line "painted on the floor" over the camera
 * view, using a ground-plane perspective projection, with white chevrons
 * drifting forward along the line (IKEA/Google-style AR guidance). The
 * horizon follows the phone's real tilt. Ported from the verified web
 * implementation — keep the pitch rotation signs as-is
 * (depth = f·cosP + h·sinP, vertical = f·sinP − h·cosP); flipping them makes
 * the path invisible at natural holding angles.
 */
export function ARPathOverlay({
  points,
  userX,
  userY,
  facingBearing,
  devicePitch = null,
  width,
  height,
}: Props) {
  const colors = useColors();

  // Animation phase 0..1 — chevrons drift forward one spacing per cycle.
  const [phase, setPhase] = useState(0);
  // Smoothed sensor values — raw compass/tilt readings jitter constantly,
  // which made the band swing around with the slightest phone movement.
  // Ease toward the live values instead of following them directly.
  const [smooth, setSmooth] = useState({ bearing: facingBearing, pitch: devicePitch ?? 75 });
  const targetRef = useRef({ bearing: facingBearing, pitch: devicePitch ?? 75 });
  targetRef.current = { bearing: facingBearing, pitch: devicePitch ?? 75 };
  useEffect(() => {
    const step = (CHEVRON_SPEED * (TICK_MS / 1000)) / CHEVRON_SPACING;
    const id = setInterval(() => {
      setPhase((p) => (p + step) % 1);
      setSmooth((s) => {
        const t = targetRef.current;
        // Shortest-arc easing for the compass bearing (wraps at 360).
        let diff = ((t.bearing - s.bearing + 540) % 360) - 180;
        // Deadband: ignore tiny jitter entirely; ease through real turns.
        if (Math.abs(diff) < 1.5) diff = 0;
        const bearing = (s.bearing + diff * 0.18 + 360) % 360;
        const pitch = s.pitch + (t.pitch - s.pitch) * 0.25;
        if (diff === 0 && Math.abs(t.pitch - s.pitch) < 0.2) return s;
        return { bearing, pitch };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ---- Ground-plane geometry (user-relative, meters) ----
  const ground = useMemo(() => {
    if (points.length < 2) return null;

    const rad = (smooth.bearing * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const relative = points.map((p) => {
      const dx = p.x - userX;
      const dy = p.y - userY;
      // Floorplan: bearing 0 = -y. Forward axis = (sin, -cos), right axis = (cos, sin).
      return { forward: dx * sin - dy * cos, right: dx * cos + dy * sin };
    });

    // Densify segments (with cumulative travelled distance) so the projected
    // curve bends smoothly and chevrons can be placed by distance.
    // Only the CURRENT step is drawn — the band stops at the next turn.
    const maxSegments = Math.min(relative.length - 1, 1);
    const dense: { forward: number; right: number; dist: number }[] = [];
    let travelled = 0;
    outer: for (let i = 0; i < maxSegments; i++) {
      const a = relative[i];
      const b = relative[i + 1];
      const segLen = Math.hypot(b.forward - a.forward, b.right - a.right);
      const steps = Math.max(Math.ceil(segLen / SEGMENT_STEP), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        if (s > 0) travelled += segLen / steps;
        dense.push({
          forward: a.forward + (b.forward - a.forward) * t,
          right: a.right + (b.right - a.right) * t,
          dist: travelled,
        });
        if (travelled > MAX_AHEAD) break outer;
      }
    }
    if (dense.length < 2) return null;
    return { dense, total: dense[dense.length - 1].dist };
  }, [points, userX, userY, smooth.bearing]);

  // ---- Perspective projection of a ground point ----
  const focal = height * 0.9;
  const betaDeg = smooth.pitch; // smoothed tilt (see above)
  const pitchDown = Math.min(Math.max(((90 - betaDeg) * Math.PI) / 180, -0.5), 0.9);
  const cosP = Math.cos(pitchDown);
  const sinP = Math.sin(pitchDown);
  const cx = width / 2;
  const cy = height / 2;
  const NEAR_PLANE = 0.5;
  const project = (forward: number, right: number) => {
    const depth = forward * cosP + CAMERA_HEIGHT * sinP;
    if (depth < NEAR_PLANE) return null;
    const vertical = forward * sinP - CAMERA_HEIGHT * cosP;
    return {
      x: cx + (right / depth) * focal,
      y: cy - (vertical / depth) * focal,
      forward,
    };
  };

  // ---- Painted band: offset the centerline sideways in the GROUND plane,
  // then project both edges. Constant real-world width (like tape on the
  // floor) — perspective alone makes it converge far away.
  const band = useMemo(() => {
    if (!ground) return null;
    const { dense } = ground;
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i < dense.length; i++) {
      const p = dense[i];
      const q = dense[Math.min(i + 1, dense.length - 1)];
      const r = dense[Math.max(i - 1, 0)];
      let df = q.forward - r.forward;
      let dr = q.right - r.right;
      const len = Math.hypot(df, dr);
      if (len < 1e-6) continue;
      df /= len;
      dr /= len;
      const lp = project(p.forward - dr * PATH_HALF_W, p.right + df * PATH_HALF_W);
      const rp = project(p.forward + dr * PATH_HALF_W, p.right - df * PATH_HALF_W);
      if (!lp || !rp) {
        if (left.length) break;
        continue;
      }
      if (lp.y > height + 200 && rp.y > height + 200) continue;
      left.push({ x: lp.x, y: lp.y });
      right.push({ x: rp.x, y: rp.y });
    }
    if (left.length < 2) return null;
    return [...left, ...right.reverse()].map((p) => `${p.x},${p.y}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground, smooth.pitch, width, height]);

  // ---- Chevrons drifting along the ground path ----
  const chevrons = useMemo(() => {
    if (!ground) return [];
    const { dense, total } = ground;
    // Interpolate position + direction at a given distance along the path.
    const at = (dist: number) => {
      let i = 1;
      while (i < dense.length - 1 && dense[i].dist < dist) i++;
      const a = dense[i - 1];
      const b = dense[i];
      const span = Math.max(b.dist - a.dist, 1e-6);
      const t = Math.min(Math.max((dist - a.dist) / span, 0), 1);
      const forward = a.forward + (b.forward - a.forward) * t;
      const right = a.right + (b.right - a.right) * t;
      const len = Math.max(Math.hypot(b.forward - a.forward, b.right - a.right), 1e-6);
      const df = (b.forward - a.forward) / len;
      const dr = (b.right - a.right) / len;
      return { forward, right, df, dr };
    };

    const out: { pts: string; w: number; opacity: number }[] = [];
    for (let d = 1.2 + phase * CHEVRON_SPACING; d < Math.min(total, MAX_AHEAD); d += CHEVRON_SPACING) {
      const p = at(d);
      // Chevron in the ground plane: tip forward, two wings back-out.
      const tip = project(p.forward + p.df * CHEVRON_LEN * 0.6, p.right + p.dr * CHEVRON_LEN * 0.6);
      const left = project(
        p.forward - p.df * CHEVRON_LEN * 0.4 - p.dr * CHEVRON_HALF_W,
        p.right - p.dr * CHEVRON_LEN * 0.4 + p.df * CHEVRON_HALF_W,
      );
      const rightPt = project(
        p.forward - p.df * CHEVRON_LEN * 0.4 + p.dr * CHEVRON_HALF_W,
        p.right - p.dr * CHEVRON_LEN * 0.4 - p.df * CHEVRON_HALF_W,
      );
      if (!tip || !left || !rightPt) continue;
      if (tip.y > height + 60 || tip.y < -40) continue;
      const w = Math.min(Math.max((0.14 / Math.max(tip.forward, 0.8)) * focal, 2), 10);
      // Fade with distance so far chevrons melt into the line.
      const opacity = Math.min(Math.max(1.1 - tip.forward / MAX_AHEAD, 0.25), 0.95);
      out.push({ pts: `${left.x},${left.y} ${tip.x},${tip.y} ${rightPt.x},${rightPt.y}`, w, opacity });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground, phase, smooth.pitch, width, height]);

  if (!band) return null;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
      {/* Flat semi-transparent painted band — like blue tape on the floor. */}
      <Polygon points={band} fill={colors.primary} opacity={0.45} />
      {chevrons.map((c, i) => (
        <Polyline
          key={`chev-${i}`}
          points={c.pts}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={c.w}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={c.opacity * 0.75}
        />
      ))}
    </Svg>
  );
}
