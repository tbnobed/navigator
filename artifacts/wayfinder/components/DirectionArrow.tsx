import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  /** Degrees to rotate the arrow: 0 = straight ahead, positive = turn right. */
  rotation: number;
  size?: number;
}

export function DirectionArrow({ rotation, size = 96 }: Props) {
  const colors = useColors();
  const clamped = Math.max(-180, Math.min(180, rotation));
  const glowSize = size * 1.6;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.glow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
        ]}
      />
      <View style={{ transform: [{ rotate: `${clamped}deg` }] }}>
        <Feather name="arrow-up" size={size} color={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', backgroundColor: 'rgba(255,159,28,0.18)' },
});
