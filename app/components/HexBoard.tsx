import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import type { AxialCoord } from "../engine/board/types";
import { axialKey } from "../engine/board/types";
import type { BoardTopology } from "../engine/board/topology";
import type { Board } from "../engine/board/types";
import type { PlayerState, RoadPiece, SettlementOrCity } from "../engine/state/types";
import { axialToPixel, hexCorners, roundedPolygonPath, vertexToPixel } from "./hexLayout";
import {
  blockerFill,
  blockerRing,
  colorForPlayerIndex,
  numberTokenCold,
  numberTokenFace,
  numberTokenHot,
  numberTokenRing,
  resourceColors,
  tileHighlight,
  tileStroke,
  unclaimedEdge,
  unclaimedVertex,
  unclaimedVertexStroke,
  wastelandColor,
} from "./theme";

const HEX_SIZE = 44;
const PADDING = HEX_SIZE * 1.5;
const CORNER_RADIUS = HEX_SIZE * 0.14;

interface HexBoardProps {
  board: Board;
  topology: BoardTopology;
  buildings: Record<string, SettlementOrCity>;
  roads: Record<string, RoadPiece>;
  blockerTileKey: string | null;
  players: PlayerState[];
  onTilePress?: (coord: AxialCoord) => void;
  onVertexPress?: (vertexId: string) => void;
  onEdgePress?: (edgeId: string) => void;
}

export function HexBoard({
  board,
  topology,
  buildings,
  roads,
  blockerTileKey,
  players,
  onTilePress,
  onVertexPress,
  onEdgePress,
}: HexBoardProps) {
  const playerIndexById = useMemo(() => new Map(players.map((p, i) => [p.id, i])), [players]);

  const tileGeometry = useMemo(
    () =>
      board.tiles.map((tile) => {
        const center = axialToPixel(tile.coord, HEX_SIZE);
        return {
          tile,
          center,
          frameCorners: hexCorners(center, HEX_SIZE),
          corners: hexCorners(center, HEX_SIZE * 0.86),
        };
      }),
    [board]
  );

  const vertexGeometry = useMemo(
    () => [...topology.vertices.values()].map((v) => ({ vertex: v, point: vertexToPixel(v, HEX_SIZE) })),
    [topology]
  );

  const edgeGeometry = useMemo(
    () =>
      [...topology.edges.values()].map((e) => {
        const vA = topology.vertices.get(e.vertexIds[0])!;
        const vB = topology.vertices.get(e.vertexIds[1])!;
        return { edge: e, a: vertexToPixel(vA, HEX_SIZE), b: vertexToPixel(vB, HEX_SIZE) };
      }),
    [topology]
  );

  const bounds = useMemo(() => {
    const xs = tileGeometry.flatMap((t) => t.frameCorners.map((c) => c.x));
    const ys = tileGeometry.flatMap((t) => t.frameCorners.map((c) => c.y));
    const minX = Math.min(...xs) - PADDING;
    const maxX = Math.max(...xs) + PADDING;
    const minY = Math.min(...ys) - PADDING;
    const maxY = Math.max(...ys) + PADDING;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [tileGeometry]);

  return (
    <View style={{ width: "100%", aspectRatio: bounds.width / bounds.height }}>
      <Svg width="100%" height="100%" viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}>
        <Defs>
          <LinearGradient id="woodFrame" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#7a5530" />
            <Stop offset="55%" stopColor="#5c3d1f" />
            <Stop offset="100%" stopColor="#432a13" />
          </LinearGradient>
        </Defs>
        {tileGeometry.map(({ tile, center, corners, frameCorners }) => {
          const fill = tile.resourceId ? resourceColors[tile.resourceId] ?? "#999" : wastelandColor;
          const framePath = roundedPolygonPath(frameCorners, CORNER_RADIUS * 1.3);
          const path = roundedPolygonPath(corners, CORNER_RADIUS);
          return (
            <React.Fragment key={axialKey(tile.coord)}>
              <Path
                d={framePath}
                fill="url(#woodFrame)"
                stroke={tileStroke}
                strokeWidth={2}
                strokeLinejoin="round"
                onPress={onTilePress ? () => onTilePress(tile.coord) : undefined}
              />
              <Path
                d={path}
                fill={fill}
                stroke={tileStroke}
                strokeWidth={2}
                strokeLinejoin="round"
                onPress={onTilePress ? () => onTilePress(tile.coord) : undefined}
              />
              <Ellipse
                cx={center.x - HEX_SIZE * 0.28}
                cy={center.y - HEX_SIZE * 0.42}
                rx={HEX_SIZE * 0.5}
                ry={HEX_SIZE * 0.22}
                fill={tileHighlight}
              />
              {tile.numberToken !== null && (
                <>
                  <Circle cx={center.x} cy={center.y} r={HEX_SIZE * 0.33} fill={numberTokenRing} />
                  <Circle cx={center.x} cy={center.y} r={HEX_SIZE * 0.28} fill={numberTokenFace} />
                  <SvgText
                    x={center.x}
                    y={center.y + HEX_SIZE * 0.11}
                    fontSize={HEX_SIZE * 0.34}
                    fontWeight="bold"
                    fontFamily="Georgia, 'Times New Roman', serif"
                    fill={tile.numberToken === 6 || tile.numberToken === 8 ? numberTokenHot : numberTokenCold}
                    textAnchor="middle"
                  >
                    {tile.numberToken}
                  </SvgText>
                </>
              )}
              {axialKey(tile.coord) === blockerTileKey && (
                <>
                  <Circle cx={center.x} cy={center.y} r={HEX_SIZE * 0.2} fill={blockerFill} stroke={blockerRing} strokeWidth={2} />
                  <Circle cx={center.x - HEX_SIZE * 0.06} cy={center.y - HEX_SIZE * 0.06} r={HEX_SIZE * 0.05} fill={blockerRing} opacity={0.5} />
                </>
              )}
            </React.Fragment>
          );
        })}

        {edgeGeometry.map(({ edge, a, b }) => {
          const road = roads[edge.id];
          const color = road ? colorForPlayerIndex(playerIndexById.get(road.ownerId) ?? 0) : unclaimedEdge;
          return (
            <Line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={road ? 8 : 10}
              strokeLinecap="round"
              onPress={onEdgePress ? () => onEdgePress(edge.id) : undefined}
            />
          );
        })}

        {vertexGeometry.map(({ vertex, point }) => {
          const building = buildings[vertex.id];
          const color = building ? colorForPlayerIndex(playerIndexById.get(building.ownerId) ?? 0) : unclaimedVertex;
          const isCity = building?.buildingTypeId === "city";
          const radius = isCity ? HEX_SIZE * 0.23 : building ? HEX_SIZE * 0.17 : HEX_SIZE * 0.12;
          return (
            <React.Fragment key={vertex.id}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={color}
                stroke={building ? "#241407" : unclaimedVertexStroke}
                strokeWidth={building ? 2.5 : 1.5}
                onPress={onVertexPress ? () => onVertexPress(vertex.id) : undefined}
              />
              {isCity && <Circle cx={point.x} cy={point.y} r={radius * 0.4} fill={numberTokenFace} opacity={0.8} />}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
