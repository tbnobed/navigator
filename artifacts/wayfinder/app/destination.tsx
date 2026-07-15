import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getPois } from '@/constants/buildings';
import type { BuildingNode } from '@/constants/buildings';
import { useBuildings, getBuildingIn } from '@/lib/sites';

const CATEGORY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  Studio: 'video',
  'Meeting Room': 'users',
  'Food & Drink': 'coffee',
  Restroom: 'droplet',
  Services: 'briefcase',
  Workspace: 'monitor',
};

export default function DestinationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { buildingId, nodeId } = useLocalSearchParams<{ buildingId: string; nodeId: string }>();
  const { buildings, isLoading } = useBuildings();
  const building = getBuildingIn(buildings, buildingId);

  const grouped = useMemo(() => {
    if (!building) return [] as [number, BuildingNode[]][];
    const map = new Map<number, BuildingNode[]>();
    // Exclude the start point itself ("navigate to where I already am").
    for (const poi of getPois(building).filter((p) => p.id !== nodeId)) {
      const list = map.get(poi.floor) ?? [];
      list.push(poi);
      map.set(poi.floor, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [building, nodeId]);

  if (isLoading && !building) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Loading location…</Text>
      </View>
    );
  }

  if (!building) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Building not found.</Text>
      </View>
    );
  }

  const floorName = (level: number) => building.floors.find((f) => f.level === level)?.name ?? `Floor ${level}`;

  const handleSelect = (poi: BuildingNode) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/navigate',
      params: { buildingId: building.id, startNodeId: nodeId, destinationNodeId: poi.id },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.secondary }]}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Where are you headed?</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{building.name}</Text>
        </View>
      </View>
      <FlatList
        data={grouped}
        keyExtractor={([floor]) => String(floor)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        scrollEnabled={grouped.length > 0}
        renderItem={({ item }) => {
          const [floor, items] = item;
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{floorName(floor)}</Text>
              {items.map((poi) => (
                <TouchableOpacity
                  key={poi.id}
                  style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleSelect(poi)}
                  activeOpacity={0.8}
                  testID={`destination-${poi.id}`}
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
                    <Feather name={CATEGORY_ICON[poi.category ?? ''] ?? 'map-pin'} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{poi.label}</Text>
                    <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{poi.category}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  section: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Inter_600SemiBold',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  rowSub: { fontSize: 12, marginTop: 2, fontFamily: 'Inter_400Regular' },
});
