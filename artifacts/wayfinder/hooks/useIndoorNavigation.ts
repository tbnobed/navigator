import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Route, RoutePoint, RouteStep } from '@/lib/routing';
import { angleDiff, bearingDeg, distance } from '@/lib/geometry';
import { useCompassHeading } from './useCompassHeading';
import { usePedometerSteps } from './usePedometerSteps';

/** Average walking stride, used to convert step counts into meters travelled. */
const STRIDE_METERS = 0.75;
/** Interval (ms) between auto-steps while "simulate walking" is on. */
const SIMULATED_STEP_INTERVAL_MS = 650;

export interface NavPosition {
  x: number;
  y: number;
  floor: number;
}

/**
 * Drives indoor dead-reckoning: converts phone step counts + compass heading
 * into a live position along the planned route, without any beacons or GPS.
 *
 * - Distance walked comes from the pedometer (or a simulated walk toggle).
 * - The route polyline is used to project that distance into an (x, y)
 *   position, which keeps drift bounded to "how far along the path", not
 *   free-roaming dead reckoning.
 * - Compass heading is calibrated once against the entrance's known facing
 *   direction, so the AR arrow can be shown relative to where the phone is
 *   actually pointed.
 * - Floor changes (elevator/stairs) can't be sensed, so the user confirms
 *   them explicitly.
 */
export function useIndoorNavigation(route: Route, entranceFacingBearing: number) {
  const [legIndex, setLegIndex] = useState(0);
  const [distanceAlong, setDistanceAlong] = useState(0);
  const [simulate, setSimulate] = useState(false);
  const [headingOffset, setHeadingOffset] = useState<number | null>(null);
  const calibratedRef = useRef(false);

  const leg = route.legs[legIndex];
  const arrivedAtLegEnd = distanceAlong >= leg.totalDistance - 0.05;
  const isFinalLeg = legIndex === route.legs.length - 1;
  const arrived = isFinalLeg && arrivedAtLegEnd;
  const awaitingTransition = !isFinalLeg && arrivedAtLegEnd;

  const { heading, available: headingAvailable } = useCompassHeading(true);

  const handleStep = useCallback(
    (deltaSteps: number) => {
      setDistanceAlong((prev) => Math.min(prev + deltaSteps * STRIDE_METERS, leg.totalDistance));
    },
    [leg.totalDistance],
  );

  const { available: pedometerAvailable } = usePedometerSteps(!simulate, handleStep);

  useEffect(() => {
    if (!simulate) return;
    const id = setInterval(() => handleStep(1), SIMULATED_STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [simulate, handleStep]);

  // Calibrate the heading offset once, assuming the phone faces
  // `entranceFacingBearing` (in floorplan space) at the first heading sample.
  useEffect(() => {
    if (heading !== null && !calibratedRef.current) {
      setHeadingOffset(heading - entranceFacingBearing);
      calibratedRef.current = true;
    }
  }, [heading, entranceFacingBearing]);

  const position = useMemo<{ point: NavPosition; segmentIndex: number }>(() => {
    const points = leg.points;
    let remaining = distanceAlong;
    for (let i = 0; i < points.length - 1; i++) {
      const segLen = distance(points[i], points[i + 1]);
      if (remaining <= segLen || i === points.length - 2) {
        const ratio = segLen === 0 ? 0 : Math.min(remaining / segLen, 1);
        return {
          point: {
            x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
            y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
            floor: leg.floor,
          },
          segmentIndex: i,
        };
      }
      remaining -= segLen;
    }
    const last = points[points.length - 1];
    return { point: { x: last.x, y: last.y, floor: leg.floor }, segmentIndex: Math.max(points.length - 2, 0) };
  }, [leg, distanceAlong]);

  const nextWaypoint: RoutePoint = leg.points[Math.min(position.segmentIndex + 1, leg.points.length - 1)];
  const targetFloorplanBearing = bearingDeg(position.point, nextWaypoint);

  const facingFloorplanBearing = heading !== null && headingOffset !== null ? heading - headingOffset : null;
  const arrowRotation =
    facingFloorplanBearing !== null ? angleDiff(targetFloorplanBearing, facingFloorplanBearing) : null;

  const distanceRemainingOnLeg = Math.max(leg.totalDistance - distanceAlong, 0);
  const totalRemaining =
    distanceRemainingOnLeg + route.legs.slice(legIndex + 1).reduce((sum, l) => sum + l.totalDistance, 0);

  const currentInstruction = useMemo<RouteStep>(() => {
    const upcoming = route.steps.filter((s) => s.legIndex === legIndex && s.fromIndex >= position.segmentIndex);
    return upcoming[0] ?? route.steps[route.steps.length - 1];
  }, [route.steps, legIndex, position.segmentIndex]);

  const confirmTransition = useCallback(() => {
    if (!awaitingTransition) return;
    setLegIndex((i) => Math.min(i + 1, route.legs.length - 1));
    setDistanceAlong(0);
  }, [awaitingTransition, route.legs.length]);

  /** Manually snap position to the next waypoint — a correction control for drift. */
  const skipToNextWaypoint = useCallback(() => {
    setDistanceAlong((prev) => {
      const points = leg.points;
      let cumulative = 0;
      for (let i = 0; i < points.length - 1; i++) {
        cumulative += distance(points[i], points[i + 1]);
        if (cumulative > prev + 0.1) return cumulative;
      }
      return leg.totalDistance;
    });
  }, [leg]);

  const reset = useCallback(() => {
    setLegIndex(0);
    setDistanceAlong(0);
    calibratedRef.current = false;
    setHeadingOffset(null);
  }, []);

  return {
    position: position.point,
    floor: leg.floor,
    leg,
    legIndex,
    arrived,
    awaitingTransition,
    transition: leg.transition,
    heading,
    headingAvailable,
    pedometerAvailable,
    arrowRotation,
    targetFloorplanBearing,
    distanceRemainingOnLeg,
    totalRemaining,
    currentInstruction,
    simulate,
    setSimulate,
    confirmTransition,
    skipToNextWaypoint,
    reset,
  };
}

export type IndoorNavState = ReturnType<typeof useIndoorNavigation>;
