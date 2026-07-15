import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PermissionCard } from '@/components/PermissionCard';
import type { Building } from '@/constants/buildings';
import { useBuildings, getBuildingIn, findEntranceIn, findStartIn } from '@/lib/sites';

type Resolved = { b: string; e: string } | { b: string } | null;

/**
 * Resolve any QR payload or typed site code to navigation params.
 * Accepts: a full INDOORA://building/node value, a short "building/node"
 * (or bare building id) code, and legacy WAYFINDER:// posters.
 */
function resolveEntranceCode(buildings: Building[], raw: string): Resolved {
  const text = raw.trim();
  if (!text) return null;

  // Full URL (what the printed posters encode): ?b=<site>&e=<node>.
  try {
    const url = new URL(text);
    const b = url.searchParams.get('b');
    const e = url.searchParams.get('e');
    if (b && e) return { b, e };
  } catch {
    // not a URL — fall through
  }

  // INDOORA://building/node QR value (legacy WAYFINDER:// posters still work).
  const legacy = text.replace(/^WAYFINDER:\/\//i, 'INDOORA://');
  const byQr =
    findEntranceIn(buildings, legacy) ??
    findEntranceIn(buildings, `INDOORA://${text.toLowerCase()}`);
  if (byQr) return { b: byQr.building.id, e: byQr.entrance.nodeId };

  // Any-node code (room-level QR posters): "building/node" where node is a
  // destination rather than an entrance.
  const byNode =
    findStartIn(buildings, legacy) ?? findStartIn(buildings, `INDOORA://${text}`);
  if (byNode) return { b: byNode.building.id, e: byNode.nodeId };

  // Bare building/site id — caller shows its entrance list.
  if (getBuildingIn(buildings, text.toLowerCase())) return { b: text.toLowerCase() };

  return null;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { buildings } = useBuildings();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanning, setScanning] = useState(false);
  const [siteCode, setSiteCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<{ b: string; e: string } | null>(null);
  const lockRef = useRef(false);

  const goToDestination = useCallback((buildingId: string, nodeId: string) => {
    router.push({ pathname: '/destination', params: { buildingId, nodeId } });
  }, []);

  const applyResolved = useCallback(
    (resolved: Resolved): boolean => {
      if (!resolved) return false;
      if ('e' in resolved) {
        // Greet from the known start (entrance or room-level QR node).
        setGreeting({ b: resolved.b, e: resolved.e });
        setCodeError(null);
      } else {
        // Site known but entrance not — show only that site's entrances.
        setSiteFilter(resolved.b);
        setCodeError(null);
      }
      return true;
    },
    [],
  );

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (lockRef.current) return;
      const resolved = resolveEntranceCode(buildings, data);
      if (!resolved) return;
      lockRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScanning(false);
      applyResolved(resolved);
      setTimeout(() => {
        lockRef.current = false;
      }, 800);
    },
    [applyResolved, buildings],
  );

  const handleCodeSubmit = () => {
    Haptics.selectionAsync();
    if (!applyResolved(resolveEntranceCode(buildings, siteCode))) {
      setCodeError('Unknown site code. Check the code printed on the poster.');
    }
  };

  // ---- Greeting: a known start point was scanned/entered ----
  const greetBuilding = greeting ? getBuildingIn(buildings, greeting.b) : undefined;
  const greetEntrance = greetBuilding?.entrances.find((ent) => ent.nodeId === greeting?.e);
  const greetStartNode = greetBuilding?.nodes.find((n) => n.id === greeting?.e);
  const greetLabel = greetEntrance?.label ?? greetStartNode?.label;
  if (greeting) {
    const building = greetBuilding;
    const entrance = greetEntrance;
    const startLabel = greetLabel;
    if (building && startLabel) {
      return (
        <View
          style={[
            styles.center,
            { backgroundColor: colors.background, paddingTop: insets.top + 24 },
          ]}
        >
          <View style={[styles.brandGlyph, { backgroundColor: colors.secondary }]}>
            <Feather name="map-pin" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.greetTitle, { color: colors.foreground }]}>
            Welcome to {building.name}
          </Text>
          <Text style={[styles.greetSub, { color: colors.mutedForeground }]}>
            You are at {entrance ? 'the ' : ''}
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>
              {startLabel}
            </Text>
            . Let&apos;s get you where you need to go.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => goToDestination(greeting.b, greeting.e)}
            testID="find-destination-button"
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Find a destination
            </Text>
            <Feather name="arrow-right" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setGreeting(null);
              setSiteCode('');
            }}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>Not here? Start over</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Fell through (data still loading / stale) — show a lightweight loader
    // rather than mutating state during render.
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Loading location…</Text>
      </View>
    );
  }

  // ---- Scanner overlay ----
  if (scanning) {
    if (!permission) {
      return <View style={[styles.container, { backgroundColor: '#000' }]} />;
    }
    if (!permission.granted) {
      return (
        <View
          style={[
            styles.center,
            { backgroundColor: colors.background, paddingTop: insets.top + 24 },
          ]}
        >
          <View style={styles.permissionWrap}>
            <PermissionCard
              icon="camera"
              title="Camera access needed"
              message={
                permission.canAskAgain
                  ? 'Indoora scans the QR code at a building entrance to load its indoor map and start guiding you.'
                  : 'Camera access was denied. Enable it in Settings to scan entrance codes.'
              }
              actionLabel={permission.canAskAgain ? 'Enable Camera' : 'Try Again'}
              onPress={requestPermission}
            />
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setScanning(false)}
              testID="cancel-scan-button"
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>Enter a code instead</Text>
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
        <View style={[styles.scanBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={() => setScanning(false)} testID="cancel-scan-button">
            <Text style={styles.skipText}>Enter a code instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- Site found: pick an entrance ----
  if (siteFilter) {
    const filtered = buildings.filter((bldg) => bldg.id === siteFilter);
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.pickContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Text style={[styles.greetTitle, { color: colors.foreground, textAlign: 'left' }]}>
          Almost there
        </Text>
        <Text style={[styles.pickSub, { color: colors.mutedForeground }]}>
          Which entrance are you standing at?
        </Text>
        {filtered.map((bldg) => (
          <View key={bldg.id} style={{ gap: 12 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{bldg.name}</Text>
            {bldg.entrances.map((ent) => (
              <TouchableOpacity
                key={ent.nodeId}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => goToDestination(bldg.id, ent.nodeId)}
                activeOpacity={0.85}
                testID={`entrance-${ent.nodeId}`}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name="map-pin" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{ent.label}</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            setSiteFilter(null);
            setSiteCode('');
            setCodeError(null);
          }}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>Not this site? Start over</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---- Hero: no site chosen yet ----
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.heroContent,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.brandGlyph, { backgroundColor: colors.secondary }]}>
        <Feather name="navigation" size={40} color={colors.primary} />
      </View>
      <Text style={[styles.greetTitle, { color: colors.foreground }]}>Find your way inside</Text>
      <Text style={[styles.greetSub, { color: colors.mutedForeground }]}>
        Scan the QR poster at the entrance and Indoora will guide you to any room.
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          Haptics.selectionAsync();
          setCodeError(null);
          setScanning(true);
        }}
        testID="scan-button"
      >
        <Feather name="maximize" size={20} color={colors.primaryForeground} />
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
          Scan QR code
        </Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or enter a code</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.codeRow}>
        <TextInput
          value={siteCode}
          onChangeText={(t) => {
            setSiteCode(t);
            setCodeError(null);
          }}
          onSubmitEditing={handleCodeSubmit}
          placeholder="Site code from the poster"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          style={[
            styles.codeInput,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          testID="site-code-input"
        />
        <TouchableOpacity
          style={[
            styles.codeGo,
            { backgroundColor: siteCode.trim() ? colors.primary : colors.secondary },
          ]}
          onPress={handleCodeSubmit}
          disabled={!siteCode.trim()}
          testID="site-code-go"
        >
          <Feather
            name="arrow-right"
            size={20}
            color={siteCode.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
      <Text style={[styles.codeHint, { color: colors.mutedForeground }]}>
        It&apos;s printed under the QR code, like studios/lobby
      </Text>

      {codeError ? (
        <Text style={[styles.codeError, { color: colors.destructive }]}>{codeError}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/qr-codes')}
        testID="view-demo-codes-button"
      >
        <Text style={[styles.linkText, { color: colors.mutedForeground }]}>View demo QR codes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionWrap: { width: '100%', gap: 16 },
  linkButton: { alignItems: 'center', paddingVertical: 10, marginTop: 16 },
  linkText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // Scanner
  overlay: { alignItems: 'center', paddingHorizontal: 24, gap: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  scanBottom: { paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  skipText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_500Medium' },

  // Greeting / hero
  brandGlyph: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  greetTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  greetSub: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    maxWidth: 340,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: '100%',
    maxWidth: 360,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  heroContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 22,
    width: '100%',
    maxWidth: 360,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_600SemiBold',
  },
  codeRow: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 360 },
  codeInput: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  codeGo: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  codeHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
  },
  codeError: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 12,
  },

  // Entrance picker
  pickContent: { paddingHorizontal: 24, gap: 16 },
  pickSub: { fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Inter_600SemiBold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
