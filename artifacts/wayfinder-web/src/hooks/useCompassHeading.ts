import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Compass heading from the browser's device-orientation API.
 *
 * iOS Safari requires an explicit permission prompt triggered by a user
 * gesture (`DeviceOrientationEvent.requestPermission()`), and exposes the
 * true compass heading as the non-standard `webkitCompassHeading` (degrees
 * clockwise from north). On other browsers we fall back to `alpha` from a
 * `deviceorientationabsolute` event when available.
 */
export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  /** Front-back tilt (deviceorientation beta, degrees): ~90 = held upright, ~0 = flat on back. */
  const [pitch, setPitch] = useState<number | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    'unknown',
  );
  const listeningRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;

    // Orientation events fire at up to ~60Hz on two listeners at once; pushing
    // every sample into React state re-renders the whole nav screen (and the
    // AR overlay's projection) per event. Buffer the latest values and flush
    // once per animation frame, skipping sub-degree jitter.
    let latestHeading: number | null = null;
    let latestPitch: number | null = null;
    let rafId: number | null = null;
    let lastHeading = Number.NaN;
    let lastPitch = Number.NaN;
    const flush = () => {
      rafId = null;
      if (latestHeading !== null) {
        const delta = Math.abs(((latestHeading - lastHeading + 540) % 360) - 180);
        if (Number.isNaN(lastHeading) || delta > 0.5) {
          lastHeading = latestHeading;
          setHeading(latestHeading);
        }
      }
      if (latestPitch !== null && (Number.isNaN(lastPitch) || Math.abs(latestPitch - lastPitch) > 0.5)) {
        lastPitch = latestPitch;
        setPitch(latestPitch);
      }
    };
    const handler = (e: DeviceOrientationEvent) => {
      const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        latestHeading = webkitHeading;
      } else if (e.absolute && e.alpha !== null) {
        // alpha: 0 = facing north, increases counter-clockwise → convert to CW compass.
        latestHeading = (360 - e.alpha) % 360;
      }
      if (e.beta !== null) latestPitch = e.beta;
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };

    // iOS delivers webkitCompassHeading on the regular event; Android Chrome
    // needs the "absolute" variant for a north-referenced alpha.
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.addEventListener('deviceorientation', handler as EventListener, true);
    cleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler as EventListener, true);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  /** Must be called from a user gesture (button tap) on iOS. */
  const requestPermission = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setPermission('unsupported');
      return 'unsupported' as const;
    }
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        setPermission(result);
        // Attach listeners regardless of the reported result: on iOS, motion
        // and orientation share ONE permission, and this call can throw or
        // report "denied" simply because the user gesture was consumed by the
        // motion prompt — even though access is actually granted. If access is
        // truly denied, no events fire and this is harmless.
        startListening();
        return result;
      } catch {
        setPermission('denied');
        startListening();
        return 'denied' as const;
      }
    }
    // No permission gate (Android, desktop) — just start.
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

  return { heading, pitch, permission, requestPermission, available: heading !== null };
}
