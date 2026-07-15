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
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    'unknown',
  );
  const listeningRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;

    const handler = (e: DeviceOrientationEvent) => {
      const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
        setHeading(webkitHeading);
      } else if (e.absolute && e.alpha !== null) {
        // alpha: 0 = facing north, increases counter-clockwise → convert to CW compass.
        setHeading((360 - e.alpha) % 360);
      }
    };

    // iOS delivers webkitCompassHeading on the regular event; Android Chrome
    // needs the "absolute" variant for a north-referenced alpha.
    window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.addEventListener('deviceorientation', handler as EventListener, true);
    cleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler as EventListener, true);
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
        if (result === 'granted') startListening();
        return result;
      } catch {
        setPermission('denied');
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

  return { heading, permission, requestPermission, available: heading !== null };
}
