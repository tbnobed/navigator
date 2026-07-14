import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Live device compass heading (0-360, degrees clockwise from north).
 * Requests foreground location permission automatically since heading is a
 * secondary enhancement (dead-reckoning still degrades gracefully without it).
 */
export function useCompassHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') {
      setAvailable(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setAvailable(false);
          return;
        }
        const subscription = await Location.watchHeadingAsync((event) => {
          const value = event.trueHeading >= 0 ? event.trueHeading : event.magHeading;
          setHeading(value);
          setAvailable(true);
        });
        if (cancelled) {
          subscription.remove();
        } else {
          subscriptionRef.current = subscription;
        }
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled]);

  return { heading, available };
}
