import type { RngCursor } from "../rng";
import { shuffle } from "../rng";
import type { Ruleset, TileTypeConfig } from "../ruleset/types";
import type { AxialCoord, Board, Tile } from "./types";
import { axialKey } from "./types";
import { NEIGHBOR_DIRS } from "./topology";

const HOT_NUMBERS = new Set([6, 8]);

/** All hex coordinates for a hexagon-shaped board with `radius` rings around the center. */
export function generateHexCoordinates(radius: number): AxialCoord[] {
  const coords: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      coords.push({ q, r });
    }
  }
  return coords;
}

function buildAdjacency(coords: AxialCoord[]): Map<string, string[]> {
  const coordSet = new Set(coords.map(axialKey));
  const adjacency = new Map<string, string[]>();
  for (const c of coords) {
    const neighbors = NEIGHBOR_DIRS.map((dir) => axialKey({ q: c.q + dir.q, r: c.r + dir.r })).filter((k) =>
      coordSet.has(k)
    );
    adjacency.set(axialKey(c), neighbors);
  }
  return adjacency;
}

/**
 * Places tile types one coordinate at a time (in a fixed order), picking a
 * random still-available type that doesn't repeat a resource already on a
 * placed neighbor, backtracking if a coordinate runs out of valid options.
 * Keeps the same resource from clumping together the way a flat shuffle can.
 */
function assignTileTypes(
  rng: RngCursor,
  order: string[],
  tileTypes: TileTypeConfig[],
  adjacency: Map<string, string[]>
): Map<string, TileTypeConfig> {
  const remaining = new Map(tileTypes.map((t) => [t.id, t.count]));
  const assignment = new Map<string, TileTypeConfig>();

  function neighborResourceIds(key: string): Set<string> {
    const ids = new Set<string>();
    for (const nKey of adjacency.get(key) ?? []) {
      const placed = assignment.get(nKey);
      if (placed?.resourceId) ids.add(placed.resourceId);
    }
    return ids;
  }

  function backtrack(i: number): boolean {
    if (i === order.length) return true;
    const key = order[i];
    const blockedResources = neighborResourceIds(key);
    const candidates = shuffle(rng, tileTypes.filter((t) => (remaining.get(t.id) ?? 0) > 0));
    for (const tt of candidates) {
      if (tt.resourceId !== null && blockedResources.has(tt.resourceId)) continue;
      assignment.set(key, tt);
      remaining.set(tt.id, (remaining.get(tt.id) ?? 0) - 1);
      if (backtrack(i + 1)) return true;
      remaining.set(tt.id, (remaining.get(tt.id) ?? 0) + 1);
      assignment.delete(key);
    }
    return false;
  }

  if (!backtrack(0)) {
    throw new Error("Could not place tiles without repeating a resource on adjacent tiles.");
  }
  return assignment;
}

/** Same idea as assignTileTypes, for number tokens: no adjacent duplicates, no adjacent 6/8 pair. */
function assignNumberTokens(
  rng: RngCursor,
  order: string[],
  numberTokens: number[],
  adjacency: Map<string, string[]>
): Map<string, number> {
  const remaining = new Map<number, number>();
  for (const n of numberTokens) remaining.set(n, (remaining.get(n) ?? 0) + 1);
  const assignment = new Map<string, number>();

  function conflicts(key: string, value: number): boolean {
    for (const nKey of adjacency.get(key) ?? []) {
      const placed = assignment.get(nKey);
      if (placed === undefined) continue;
      if (placed === value) return true;
      if (HOT_NUMBERS.has(placed) && HOT_NUMBERS.has(value)) return true;
    }
    return false;
  }

  function backtrack(i: number): boolean {
    if (i === order.length) return true;
    const key = order[i];
    const candidates = shuffle(
      rng,
      [...remaining.entries()].filter(([, count]) => count > 0).map(([value]) => value)
    );
    for (const value of candidates) {
      if (conflicts(key, value)) continue;
      assignment.set(key, value);
      remaining.set(value, (remaining.get(value) ?? 0) - 1);
      if (backtrack(i + 1)) return true;
      remaining.set(value, (remaining.get(value) ?? 0) + 1);
      assignment.delete(key);
    }
    return false;
  }

  if (!backtrack(0)) {
    throw new Error("Could not place number tokens without an adjacent duplicate or 6/8 pair.");
  }
  return assignment;
}

/**
 * Builds a randomized board from a ruleset's board config. Deterministic
 * for a given rng seed, so the same seed always reproduces the same board —
 * required for server/client agreement and for replaying past games.
 * Placement is constrained (not a flat shuffle) so the same resource, or
 * two high-probability 6/8 tiles, don't end up clumped next to each other.
 */
export function generateBoard(ruleset: Ruleset, rng: RngCursor): Board {
  const coords = generateHexCoordinates(ruleset.board.radius);
  const order = coords.map(axialKey);

  const totalConfigured = ruleset.board.tileTypes.reduce((sum, t) => sum + t.count, 0);
  if (totalConfigured !== coords.length) {
    throw new Error(
      `Ruleset "${ruleset.id}": board radius ${ruleset.board.radius} has ${coords.length} tiles ` +
        `but tileTypes counts add up to ${totalConfigured}.`
    );
  }

  const adjacency = buildAdjacency(coords);
  const tileTypeAssignment = assignTileTypes(rng, order, ruleset.board.tileTypes, adjacency);

  const producingKeys = order.filter((key) => tileTypeAssignment.get(key)!.resourceId !== null);
  if (ruleset.board.numberTokens.length !== producingKeys.length) {
    throw new Error(
      `Ruleset "${ruleset.id}": ${producingKeys.length} resource-producing tiles but ` +
        `${ruleset.board.numberTokens.length} number tokens configured.`
    );
  }
  const numberAssignment = assignNumberTokens(rng, producingKeys, ruleset.board.numberTokens, adjacency);

  const tiles: Tile[] = coords.map((coord) => {
    const key = axialKey(coord);
    const tileType = tileTypeAssignment.get(key)!;
    return {
      coord,
      tileTypeId: tileType.id,
      resourceId: tileType.resourceId,
      numberToken: numberAssignment.get(key) ?? null,
    };
  });

  return { radius: ruleset.board.radius, tiles };
}
