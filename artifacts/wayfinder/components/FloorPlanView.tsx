import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { BuildingEdge, BuildingFloor, BuildingNode } from '@/constants/buildings';
import { useColors } from '@/hooks/useColors';

interface Props {
  floor: BuildingFloor;
  nodes: BuildingNode[];
  edges: BuildingEdge[];
  routePoints: { x: number; y: number }[];
  userPosition: { x: number; y: number };
  userHeading: number;
  destinationNodeId?: string;
  width: number;
  height: number;
}

export function FloorPlanView({
  floor,
  nodes,
  edges,
  routePoints,
  userPosition,
  userHeading,
  destinationNodeId,
  width,
  height,
}: Props) {
  const colors = useColors();
  const scale = Math.min(width / floor.width, height / floor.height);
  const offsetX = (width - floor.width * scale) / 2;
  const offsetY = (height - floor.height * scale) / 2;
  const toScreen = (x: number, y: number) => ({ x: offsetX + x * scale, y: offsetY + y * scale });

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const routePath = useMemo(() => {
    if (routePoints.length === 0) return '';
    return routePoints
      .map((p, i) => {
        const s = toScreen(p.x, p.y);
        return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
      })
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePoints, scale, offsetX, offsetY]);

  const user = toScreen(userPosition.x, userPosition.y);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {floor.image ? (
          <SvgImage
            x={offsetX}
            y={offsetY}
            width={floor.width * scale}
            height={floor.height * scale}
            href={floor.image}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}
        {floor.rooms.map((room) => {
          const topLeft = toScreen(room.x, room.y);
          return (
            <G key={room.id}>
              <Rect
                x={topLeft.x}
                y={topLeft.y}
                width={room.width * scale}
                height={room.height * scale}
                rx={8}
                fill={colors.secondary}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText x={topLeft.x + 8} y={topLeft.y + 18} fontSize={11} fill={colors.mutedForeground} fontWeight="600">
                {room.label}
              </SvgText>
            </G>
          );
        })}

        {floor.image ? null : edges.map((edge, i) => {
          const a = nodeById.get(edge.a);
          const b = nodeById.get(edge.b);
          if (!a || !b) return null;
          const sa = toScreen(a.x, a.y);
          const sb = toScreen(b.x, b.y);
          return (
            <Line
              key={`${edge.a}-${edge.b}-${i}`}
              x1={sa.x}
              y1={sa.y}
              x2={sb.x}
              y2={sb.y}
              stroke={colors.border}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {routePath ? (
          <Path
            d={routePath}
            stroke={colors.accent}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {nodes
          .filter((n) => n.kind !== 'junction')
          .map((n) => {
            const s = toScreen(n.x, n.y);
            const isDestination = n.id === destinationNodeId;
            return (
              <Circle
                key={n.id}
                cx={s.x}
                cy={s.y}
                r={isDestination ? 8 : 5}
                fill={isDestination ? colors.accent : colors.mutedForeground}
                stroke={colors.card}
                strokeWidth={2}
              />
            );
          })}

        <G transform={`translate(${user.x}, ${user.y}) rotate(${userHeading})`}>
          <Circle cx={0} cy={0} r={18} fill={colors.primary} opacity={0.16} />
          <Polygon points="0,-11 8,9 0,4 -8,9" fill={colors.primary} stroke={colors.card} strokeWidth={1.5} />
        </G>
      </Svg>
    </View>
  );
}
