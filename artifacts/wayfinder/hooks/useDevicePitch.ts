import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

/**
 * Live phone front-back tilt in degrees, matching the web deviceorientation
 * `beta` convention: ~90 = held upright looking straight ahead, smaller =
 * tilted down toward the floor. Null until the first reading (the AR overlay
 * falls back to a natural holding-angle assumption).
 */
export function useDevicePitch(enabled: boolean) {
  const [pitch, setPitch] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      // Drop any stale reading so re-entering AR starts from the fallback
      // tilt until a fresh sensor sample arrives.
      setPitch(null);
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Attach regardless of the reported permission/availability status —
        // on iOS the status can lag reality; trust received events instead.
        await DeviceMotion.requestPermissionsAsync().catch(() => undefined);
        if (cancelled) return;
        DeviceMotion.setUpdateInterval(80);
        subscription = DeviceMotion.addListener((event) => {
          const beta = event.rotation?.beta;
          if (typeof beta === 'number' && Number.isFinite(beta)) {
            setPitch((beta * 180) / Math.PI);
          }
        });
      } catch {
        // Sensor unavailable — overlay uses its fixed-tilt fallback.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return pitch;
}
