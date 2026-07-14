import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PermissionCard } from '@/components/PermissionCard';
import { buildings, findEntranceByQr } from '@/constants/buildings';

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);
  const lockRef = useRef(false);

  const mainEntrance = buildings[0].entrances[0];

  const goToDestination = useCallback((buildingId: string, nodeId: string) => {
    router.push({ pathname: '/destination', params: { buildingId, nodeId } });
  }, []);

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (lockRef.current) return;
      const match = findEntranceByQr(data);
      if (!match) return;
      lockRef.current = true;
      setScannedLabel(match.entrance.label);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        goToDestination(match.building.id, match.entrance.nodeId);
      }, 650);
    },
    [goToDestination],
  );

  const handleSkip = () => {
    Haptics.selectionAsync();
    goToDestination(buildings[0].id, mainEntrance.nodeId);
  };

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
        <View style={styles.permissionWrap}>
          <PermissionCard
            icon="camera"
            title="Camera access needed"
            message={
              permission.canAskAgain
                ? 'Wayfinder scans the QR code at a building entrance to load its indoor map and start guiding you.'
                : 'Camera access was denied. Enable it in Settings to scan entrance codes.'
            }
            actionLabel={permission.canAskAgain ? 'Enable Camera' : 'Try Again'}
            onPress={requestPermission}
          />
          <TouchableOpacity style={styles.linkButton} onPress={handleSkip} testID="skip-scan-button">
            <Text style={[styles.linkText, { color: colors.primary }]}>Continue without scanning</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Scan entrance code</Text>
        <Text style={styles.subtitle}>Point your camera at the QR code posted by the door</Text>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
      </View>

      {scannedLabel ? (
        <View style={styles.scannedBanner}>
          <Feather name="check-circle" size={20} color="#fff" />
          <Text style={styles.scannedText}>{scannedLabel}</Text>
        </View>
      ) : null}

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/qr-codes')}
          activeOpacity={0.85}
          testID="view-demo-codes-button"
        >
          <Feather name="grid" size={18} color="#fff" />
          <Text style={styles.secondaryButtonText}>View demo QR codes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} testID="skip-main-entrance-button">
          <Text style={styles.skipText}>Skip — use Main Entrance</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionWrap: { width: '100%', gap: 16 },
  linkButton: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  overlay: { alignItems: 'center', paddingHorizontal: 24, gap: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' },
  scannedBanner: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46,160,67,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  scannedText: { color: '#fff', fontWeight: '700', fontFamily: 'Inter_700Bold' },
  bottomSheet: { paddingHorizontal: 24, paddingTop: 16, gap: 14, alignItems: 'center' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  secondaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  skipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_500Medium' },
});
