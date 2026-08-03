import type { AxialCoord, Board } from "./types";
import { axialKey } from "./types";

/**
 * Vertices and edges of the hex board — the corner points and connecting
 * segments where roads/settlements/cities actually get placed. Built purely
 * from tile coordinates, independent of which coordinates are real board
 * tiles, so boundary corners/edges (which only touch 1-2 real tiles) come
 * out with the same shape as interior ones.
 */
export interface Vertex {
  id: string;
  /** The (up to 3) tile coordinates that meet at this corner. */
  tileCoords: AxialCoord[];
}

export interface Edge {
  id: string;
  /** The (up to 2) tile coordinates this edge separates. */
  tileCoords: AxialCoord[];
  vertexIds: [string, string];
}

export interface BoardTopology {
  vertices: Map<string, Vertex>;
  edges: Map<string, Edge>;
  /** vertexId -> edgeIds touching it. */
  vertexEdges: Map<string, string[]>;
  /** vertexId -> vertexIds directly connected to it by one edge. */
  vertexNeighbors: Map<string, string[]>;
}

const NEIGHBOR_DIRS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

function add(a: AxialCoord, b: AxialCoord): AxialCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

function sortedCoordKey(coords: AxialCoord[]): string {
  return coords
    .map(axialKey)
    .sort()
    .join("|");
}

export function computeBoardTopology(board: Board): BoardTopology {
  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();

  const cornerKeyAt = (tileCoord: AxialCoord, j: number): string => {
    const nJ = add(tileCoord, NEIGHBOR_DIRS[j % 6]);
    const nJ1 = add(tileCoord, NEIGHBOR_DIRS[(j + 1) % 6]);
    const triple = [tileCoord, nJ, nJ1];
    const key = sortedCoordKey(triple);
    if (!vertices.has(key)) {
      vertices.set(key, { id: key, tileCoords: triple });
    }
    return key;
  };

  for (const tile of board.tiles) {
    for (let k = 0; k < 6; k++) {
      const neighbor = add(tile.coord, NEIGHBOR_DIRS[k]);
      const edgeTiles = [tile.coord, neighbor];
      const edgeKey = sortedCoordKey(edgeTiles);
      if (edges.has(edgeKey)) continue;

      const vA = cornerKeyAt(tile.coord, (k - 1 + 6) % 6);
      const vB = cornerKeyAt(tile.coord, k);
      edges.set(edgeKey, { id: edgeKey, tileCoords: edgeTiles, vertexIds: [vA, vB] });
    }
  }

  const vertexEdges = new Map<string, string[]>();
  const vertexNeighbors = new Map<string, string[]>();
  for (const edge of edges.values()) {
    const [vA, vB] = edge.vertexIds;
    vertexEdges.set(vA, [...(vertexEdges.get(vA) ?? []), edge.id]);
    vertexEdges.set(vB, [...(vertexEdges.get(vB) ?? []), edge.id]);
    vertexNeighbors.set(vA, [...(vertexNeighbors.get(vA) ?? []), vB]);
    vertexNeighbors.set(vB, [...(vertexNeighbors.get(vB) ?? []), vA]);
  }

  return { vertices, edges, vertexEdges, vertexNeighbors };
}
