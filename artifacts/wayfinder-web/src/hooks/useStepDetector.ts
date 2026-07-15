import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Step detection from the browser's accelerometer (devicemotion).
 *
 * There is no pedometer API on the web, so we detect steps ourselves:
 * a low-pass-filtered acceleration magnitude crossing a threshold with a
 * refractory period is a reliable-enough walking-step detector for
 * dead-reckoning prototypes.
 *
 * iOS Safari requires `DeviceMotionEvent.requestPermission()` from a user
 * gesture (same prompt family as device orientation).
 */

/**
 * Peak threshold above gravity-filtered baseline (m/s²).
 * 1.6 missed gentle indoor walking with the phone held up in front (AR pose)
 * on iPhone — steps land much softer than with the phone in a pocket.
 */
const STEP_THRESHOLD = 1.0;
/** Minimum time between detected steps (ms) — max cadence ~3 steps/sec. */
const STEP_COOLDOWN_MS = 320;
/** Low-pass smoothing factor for the gravity estimate. */
const GRAVITY_ALPHA = 0.9;

export function useStepDetector(enabled: boolean, onStep: (steps: number) => void) {
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    'unknown',
  );
  const [available, setAvailable] = useState(false);
  const listeningRef = useRef(false);
  const onStepRef = useRef(onStep);
  const enabledRef = useRef(enabled);
  onStepRef.current = onStep;
  enabledRef.current = enabled;

  const gravityRef = useRef(9.81);
  const lastStepAtRef = useRef(0);
  const aboveRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      setAvailable(true);
      if (!enabledRef.current) return;

      const magnitude = Math.hypot(acc.x, acc.y, acc.z);
      // Track gravity baseline with a low-pass filter, then look at the
      // high-frequency residual for step impacts.
      gravityRef.current = GRAVITY_ALPHA * gravityRef.current + (1 - GRAVITY_ALPHA) * magnitude;
      const residual = magnitude - gravityRef.current;

      const now = Date.now();
      if (residual > STEP_THRESHOLD && !aboveRef.current) {
        aboveRef.current = true;
        if (now - lastStepAtRef.current > STEP_COOLDOWN_MS) {
          lastStepAtRef.current = now;
          onStepRef.current(1);
        }
      } else if (residual < STEP_THRESHOLD * 0.5) {
        aboveRef.current = false;
      }
    };

    window.addEventListener('devicemotion', handler, true);
    cleanupRef.current = () => window.removeEventListener('devicemotion', handler, true);
  }, []);

  /** Must be called from a user gesture (button tap) on iOS. */
  const requestPermission = useCallback(async () => {
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof window.DeviceMotionEvent === 'undefined') {
      setPermission('unsupported');
      return 'unsupported' as const;
    }
    if (typeof DME.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission();
        setPermission(result);
        if (result === 'granted') startListening();
        return result;
      } catch {
        setPermission('denied');
        return 'denied' as const;
      }
    }
    setPermission('granted');
    startListening();
    return 'granted' as const;
  }, [startListening]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      listeningRef.current = false;
    };
  }, []);

  return { permission, requestPermission, available };
}
