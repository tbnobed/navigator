import { ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { buildings } from '@/constants/buildings';

export default function QrCodesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const building = buildings[0];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>{building.name}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        These stand in for the printed codes posted at each entrance. Point the scanner at one to start a
        walkthrough.
      </Text>
      {building.entrances.map((entrance) => (
        <View
          key={entrance.qrValue}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.qrWrap}>
            <QRCode value={entrance.qrValue} size={148} color="#12172B" backgroundColor="#FFFFFF" />
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>{entrance.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18 },
  heading: { fontSize: 22, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', gap: 14 },
  qrWrap: { padding: 12, backgroundColor: '#fff', borderRadius: 16 },
  label: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
