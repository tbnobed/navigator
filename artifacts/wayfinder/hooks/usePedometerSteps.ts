import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

/**
 * Watches the device step counter and reports step deltas via `onStep`.
 * Used to drive dead-reckoning movement along the planned route.
 */
export function usePedometerSteps(enabled: boolean, onStep: (deltaSteps: number) => void) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const lastCountRef = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') {
      setAvailable(false);
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (!isAvailable) {
          if (!cancelled) setAvailable(false);
          return;
        }
        lastCountRef.current = null;
        subscription = Pedometer.watchStepCount((result) => {
          if (lastCountRef.current === null) {
            lastCountRef.current = result.steps;
            return;
          }
          const delta = result.steps - lastCountRef.current;
          if (delta > 0) {
            lastCountRef.current = result.steps;
            onStepRef.current(delta);
          }
        });
        if (!cancelled) setAvailable(true);
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return { available };
}
