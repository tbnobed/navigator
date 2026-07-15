import { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { PermissionCard } from '@/components/PermissionCard';
import { FloorPlanView } from '@/components/FloorPlanView';
import { DirectionArrow } from '@/components/DirectionArrow';
import { InstructionCard } from '@/components/InstructionCard';
import { ARPathOverlay } from '@/components/ARPathOverlay';
import { getBuilding, getNode } from '@/constants/buildings';
import type { Building, BuildingNode } from '@/constants/buildings';
import { buildRoute, findShortestPath } from '@/lib/routing';
import type { Route } from '@/lib/routing';
import { useIndoorNavigation } from '@/hooks/useIndoorNavigation';
import type { IndoorNavState } from '@/hooks/useIndoorNavigation';

const SCREEN = Dimensions.get('window');

type ViewMode = 'map' | 'ar';

function useRoute(
  building: Building | undefined,
  startNodeId: string | undefined,
  destinationNodeId: string | undefined,
): { route: Route | null; destination: BuildingNode | undefined } {
  return useMemo(() => {
    if (!building || !startNodeId || !destinationNodeId) return { route: null, destination: undefined };
    const path = findShortestPath(building, startNodeId, destinationNodeId);
    if (!path) return { route: null, destination: getNode(building, destinationNodeId) };
    return {
      route: buildRoute(building, path.nodeIds, path.edges),
      destination: getNode(building, destinationNodeId),
    };
  }, [building, startNodeId, destinationNodeId]);
}

export default function NavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { buildingId, startNodeId, destinationNodeId } = useLocalSearchParams<{
    buildingId: string;
    startNodeId: string;
    destinationNodeId: string;
  }>();
  const building = getBuilding(buildingId);
  const { route, destination } = useRoute(building, startNodeId, destinationNodeId);
  const facingBearing = building?.entrances.find((e) => e.nodeId === startNodeId)?.facingBearing ?? 0;

  if (!building || !route || !destination) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Couldn&apos;t find a route.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigateContent
      building={building}
      route={route}
      destination={destination}
      facingBearing={facingBearing}
    />
  );
}

function NavigateContent({
  building,
  route,
  destination,
  facingBearing,
}: {
  building: Building;
  route: Route;
  destination: BuildingNode;
  facingBearing: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const nav: IndoorNavState = useIndoorNavigation(route, facingBearing);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [calibrating, setCalibrating] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const floor = building.floors.find((f) => f.level === nav.floor)!;
  const floorNodes = building.nodes.filter((n) => n.floor === nav.floor);
  const floorEdges = building.edges.filter((e) => {
    const a = building.nodes.find((n) => n.id === e.a);
    const b = building.nodes.find((n) => n.id === e.b);
    return a?.floor === nav.floor && b?.floor === nav.floor;
  });

  const handleToggleView = () => {
    Haptics.selectionAsync();
    setViewMode(viewMode === 'map' ? 'ar' : 'map');
  };

  const handleToggleSimulate = () => {
    Haptics.selectionAsync();
    nav.setSimulate(!nav.simulate);
  };

  const handleCorrect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nav.skipToNextWaypoint();
  };

  const handleConfirmTransition = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    nav.confirmTransition();
  };

  const handleAdjust = (delta: number) => {
    Haptics.selectionAsync();
    nav.adjustHeading(delta);
  };

  const backButton = (dark?: boolean) => (
    <TouchableOpacity
      style={[
        styles.backFab,
        { top: insets.top + 10, backgroundColor: dark ? 'rgba(18,23,43,0.7)' : colors.card },
      ]}
      onPress={() => router.back()}
      testID="back-button"
    >
      <Feather name="chevron-left" size={22} color={dark ? '#fff' : colors.foreground} />
    </TouchableOpacity>
  );

  if (nav.arrived) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.arrivedIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="check-circle" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.arrivedTitle, { color: colors.foreground }]}>You&apos;ve arrived</Text>
        <Text style={[styles.arrivedSub, { color: colors.mutedForeground }]}>{destination.label}</Text>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          testID="done-button"
        >
          <Text style={[styles.doneButtonText, { color: colors.primaryForeground }]}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (nav.awaitingTransition && nav.transition) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.arrivedIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="chevrons-up" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.arrivedTitle, { color: colors.foreground }]}>
          Take the {nav.transition.mode} to Floor {nav.transition.toFloor}
        </Text>
        <Text style={[styles.arrivedSub, { color: colors.mutedForeground }]}>
          Once you&apos;ve arrived on the new floor, confirm to continue.
        </Text>
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={handleConfirmTransition}
          testID="confirm-transition-button"
        >
          <Text style={[styles.doneButtonText, { color: colors.primaryForeground }]}>
            I&apos;m on Floor {nav.transition.toFloor}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (calibrating) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {backButton()}
        <Text style={[styles.arrivedTitle, { color: colors.foreground }]}>Set your direction</Text>
        <Text style={[styles.arrivedSub, { color: colors.mutedForeground, maxWidth: 300 }]}>
          Face down the hallway you&apos;re about to walk. The arrow should point the way to{' '}
          {destination.label}. If it looks off, nudge it with the buttons below.
        </Text>
        <View style={styles.calibrationArrow}>
          <DirectionArrow rotation={nav.arrowRotation} size={110} />
        </View>
        <View style={styles.calibrationControls}>
          <TouchableOpacity
            style={[styles.rotateButton, { backgroundColor: colors.secondary }]}
            onPress={() => handleAdjust(-15)}
            testID="rotate-left-button"
          >
            <Feather name="rotate-ccw" size={20} color={colors.foreground} />
            <Text style={[styles.rotateText, { color: colors.foreground }]}>15°</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rotateButton, { backgroundColor: colors.secondary }]}
            onPress={() => handleAdjust(15)}
            testID="rotate-right-button"
          >
            <Feather name="rotate-cw" size={20} color={colors.foreground} />
            <Text style={[styles.rotateText, { color: colors.foreground }]}>15°</Text>
          </TouchableOpacity>
        </View>
        {!nav.headingAvailable ? (
          <Text style={[styles.calibrationNote, { color: colors.mutedForeground }]}>
            No compass detected — direction is estimated from the entrance and your adjustments.
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCalibrating(false);
          }}
          testID="start-walking-button"
        >
          <Text style={[styles.doneButtonText, { color: colors.primaryForeground }]}>Start walking</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (viewMode === 'ar') {
    if (!cameraPermission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    if (!cameraPermission.granted) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
          <PermissionCard
            icon="camera"
            title="Camera access needed"
            message="AR mode overlays a direction arrow on your camera view."
            actionLabel="Enable Camera"
            onPress={requestCameraPermission}
          />
          <TouchableOpacity style={{ marginTop: 16 }} onPress={handleToggleView}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Use Map instead</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.arContainer}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
        <ARPathOverlay
          points={nav.upcomingPoints}
          userX={nav.position.x}
          userY={nav.position.y}
          facingBearing={nav.facingFloorplanBearing}
          width={SCREEN.width}
          height={SCREEN.height}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.arArrowWrap}>
            <DirectionArrow rotation={nav.arrowRotation} size={72} />
          </View>
        </View>
        {backButton(true)}
        <View style={[styles.arTop, { paddingTop: insets.top + 60 }]}>
          <InstructionCard
            instruction={nav.currentInstruction.instruction}
            distanceMeters={nav.distanceRemainingOnLeg}
            dark
          />
        </View>
        <NavControls
          insetBottom={insets.bottom}
          viewMode={viewMode}
          simulate={nav.simulate}
          onToggleView={handleToggleView}
          onToggleSimulate={handleToggleSimulate}
          onCorrect={handleCorrect}
          dark
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.mapTop, { paddingTop: insets.top + 12, paddingLeft: 64 }]}>
        <Text style={[styles.destinationLabel, { color: colors.mutedForeground }]}>Heading to</Text>
        <Text style={[styles.destinationTitle, { color: colors.foreground }]}>{destination.label}</Text>
      </View>
      {backButton()}

      <View style={styles.mapWrap}>
        <FloorPlanView
          floor={floor}
          nodes={floorNodes}
          edges={floorEdges}
          routePoints={nav.leg.points}
          userPosition={nav.position}
          userHeading={nav.facingFloorplanBearing}
          destinationNodeId={destination.id}
          width={SCREEN.width}
          height={SCREEN.height * 0.5}
        />
      </View>

      <View style={styles.mapBottom}>
        <InstructionCard
          instruction={nav.currentInstruction.instruction}
          distanceMeters={nav.distanceRemainingOnLeg}
        />
        <NavControls
          insetBottom={insets.bottom}
          viewMode={viewMode}
          simulate={nav.simulate}
          onToggleView={handleToggleView}
          onToggleSimulate={handleToggleSimulate}
          onCorrect={handleCorrect}
        />
      </View>
    </View>
  );
}

function NavControls({
  insetBottom,
  viewMode,
  simulate,
  onToggleView,
  onToggleSimulate,
  onCorrect,
  dark,
}: {
  insetBottom: number;
  viewMode: ViewMode;
  simulate: boolean;
  onToggleView: () => void;
  onToggleSimulate: () => void;
  onCorrect: () => void;
  dark?: boolean;
}) {
  const colors = useColors();
  const chipBg = dark ? 'rgba(255,255,255,0.14)' : colors.secondary;
  const chipFg = dark ? '#FFFFFF' : colors.foreground;
  const activeBg = colors.primary;
  const activeFg = colors.primaryForeground;

  return (
    <View style={[styles.controls, { paddingBottom: insetBottom + 14 }]}>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: chipBg }]}
        onPress={onToggleView}
        testID="toggle-view-button"
      >
        <Feather name={viewMode === 'map' ? 'camera' : 'map'} size={16} color={chipFg} />
        <Text style={[styles.chipText, { color: chipFg }]}>{viewMode === 'map' ? 'AR View' : 'Map View'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: simulate ? activeBg : chipBg }]}
        onPress={onToggleSimulate}
        testID="toggle-simulate-button"
      >
        <Feather name="play" size={16} color={simulate ? activeFg : chipFg} />
        <Text style={[styles.chipText, { color: simulate ? activeFg : chipFg }]}>
          {simulate ? 'Simulating…' : 'Simulate walk'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.chip, { backgroundColor: chipBg }]}
        onPress={onCorrect}
        testID="correct-position-button"
      >
        <Feather name="crosshair" size={16} color={chipFg} />
        <Text style={[styles.chipText, { color: chipFg }]}>Correct position</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mapTop: { paddingHorizontal: 20, paddingBottom: 8 },
  destinationLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  destinationTitle: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  mapWrap: { alignItems: 'center' },
  mapBottom: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 14, justifyContent: 'flex-end' },
  controls: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  chipText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  arrivedIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  arrivedTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', fontFamily: 'Inter_700Bold' },
  arrivedSub: { fontSize: 14, marginTop: 6, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  doneButton: { marginTop: 28, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 999 },
  doneButtonText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  arContainer: { flex: 1, backgroundColor: '#000' },
  arArrowWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  arHint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  arTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  backFab: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  calibrationArrow: { marginVertical: 28 },
  calibrationControls: { flexDirection: 'row', gap: 16 },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  rotateText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  calibrationNote: { fontSize: 12, marginTop: 16, textAlign: 'center', maxWidth: 280, fontFamily: 'Inter_400Regular' },
});
