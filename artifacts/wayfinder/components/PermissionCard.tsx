import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  actionLabel: string;
  onPress: () => void;
}

export function PermissionCard({ icon, title, message, actionLabel, onPress }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.85}
        testID="permission-request-button"
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 10, width: '100%' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter_400Regular' },
  button: { marginTop: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999 },
  buttonText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
