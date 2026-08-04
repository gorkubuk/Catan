import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import type { AxialCoord } from "../engine/board/types";
import { axialKey } from "../engine/board/types";
import type { BoardTopology } from "../engine/board/topology";
import type { Board } from "../engine/board/types";
import type { PlayerState, RoadPiece, SettlementOrCity } from "../engine/state/types";
import { axialToPixel, hexCorners, vertexToPixel } from "./hexLayout";
import { colorForPlayerIndex, resourceColors, wastelandColor } from "./theme";

const HEX_SIZE = 44;
const PADDING = HEX_SIZE * 1.5;

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
      board.tiles.map((tile) => ({
        tile,
        center: axialToPixel(tile.coord, HEX_SIZE),
        corners: hexCorners(axialToPixel(tile.coord, HEX_SIZE), HEX_SIZE * 0.96),
      })),
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
    const xs = tileGeometry.flatMap((t) => t.corners.map((c) => c.x));
    const ys = tileGeometry.flatMap((t) => t.corners.map((c) => c.y));
    const minX = Math.min(...xs) - PADDING;
    const maxX = Math.max(...xs) + PADDING;
    const minY = Math.min(...ys) - PADDING;
    const maxY = Math.max(...ys) + PADDING;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [tileGeometry]);

  return (
    <View style={{ width: "100%", aspectRatio: bounds.width / bounds.height }}>
      <Svg width="100%" height="100%" viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}>
        {tileGeometry.map(({ tile, center, corners }) => {
          const fill = tile.resourceId ? resourceColors[tile.resourceId] ?? "#999" : wastelandColor;
          const points = corners.map((c) => `${c.x},${c.y}`).join(" ");
          return (
            <React.Fragment key={axialKey(tile.coord)}>
              <Polygon
                points={points}
                fill={fill}
                stroke="#1a1a1a"
                strokeWidth={1.5}
                onPress={onTilePress ? () => onTilePress(tile.coord) : undefined}
              />
              {tile.numberToken !== null && (
                <>
                  <Circle cx={center.x} cy={center.y} r={HEX_SIZE * 0.32} fill="#fdf6e3" stroke="#1a1a1a" />
                  <SvgText
                    x={center.x}
                    y={center.y + HEX_SIZE * 0.11}
                    fontSize={HEX_SIZE * 0.34}
                    fontWeight="bold"
                    fill={tile.numberToken === 6 || tile.numberToken === 8 ? "#c0392b" : "#1a1a1a"}
                    textAnchor="middle"
                  >
                    {tile.numberToken}
                  </SvgText>
                </>
              )}
              {axialKey(tile.coord) === blockerTileKey && (
                <Circle cx={center.x} cy={center.y} r={HEX_SIZE * 0.18} fill="#222" stroke="#fff" strokeWidth={2} />
              )}
            </React.Fragment>
          );
        })}

        {edgeGeometry.map(({ edge, a, b }) => {
          const road = roads[edge.id];
          const color = road ? colorForPlayerIndex(playerIndexById.get(road.ownerId) ?? 0) : "#ffffff33";
          return (
            <Line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={road ? 7 : 10}
              strokeLinecap="round"
              onPress={onEdgePress ? () => onEdgePress(edge.id) : undefined}
            />
          );
        })}

        {vertexGeometry.map(({ vertex, point }) => {
          const building = buildings[vertex.id];
          const color = building ? colorForPlayerIndex(playerIndexById.get(building.ownerId) ?? 0) : "#ffffff";
          const radius = building?.buildingTypeId === "city" ? HEX_SIZE * 0.22 : building ? HEX_SIZE * 0.16 : HEX_SIZE * 0.13;
          return (
            <Circle
              key={vertex.id}
              cx={point.x}
              cy={point.y}
              r={radius}
              fill={color}
              stroke="#1a1a1a"
              strokeWidth={building ? 2 : 1}
              onPress={onVertexPress ? () => onVertexPress(vertex.id) : undefined}
            />
          );
        })}
      </Svg>
    </View>
  );
}
