import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  instruction: string;
  distanceMeters: number;
  dark?: boolean;
}

function iconFor(instruction: string): keyof typeof Feather.glyphMap {
  const lower = instruction.toLowerCase();
  if (lower.includes('elevator') || lower.includes('stairs')) return 'chevrons-up';
  if (lower.includes('arrived')) return 'check-circle';
  if (lower.includes('sharply right') || lower.includes('turn right')) return 'corner-up-right';
  if (lower.includes('sharply left') || lower.includes('turn left')) return 'corner-up-left';
  return 'arrow-up';
}

export function InstructionCard({ instruction, distanceMeters, dark }: Props) {
  const colors = useColors();
  const backgroundColor = dark ? 'rgba(18,23,43,0.85)' : colors.card;
  const foreground = dark ? '#FFFFFF' : colors.foreground;
  const subForeground = dark ? 'rgba(255,255,255,0.72)' : colors.mutedForeground;
  const iconBg = dark ? 'rgba(255,255,255,0.12)' : colors.secondary;

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Feather name={iconFor(instruction)} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.instruction, { color: foreground }]}>{instruction}</Text>
        {distanceMeters > 0 ? (
          <Text style={[styles.distance, { color: subForeground }]}>{Math.round(distanceMeters)} m</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  instruction: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  distance: { fontSize: 13, marginTop: 2, fontFamily: 'Inter_500Medium' },
});
