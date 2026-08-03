import type { RngCursor } from "../rng";
import { shuffle } from "../rng";
import type { Ruleset } from "../ruleset/types";
import type { AxialCoord, Board, Tile } from "./types";

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

/**
 * Builds a randomized board from a ruleset's board config. Deterministic
 * for a given rng seed, so the same seed always reproduces the same board —
 * required for server/client agreement and for replaying past games.
 */
export function generateBoard(ruleset: Ruleset, rng: RngCursor): Board {
  const coords = generateHexCoordinates(ruleset.board.radius);

  const tileTypePool = ruleset.board.tileTypes.flatMap((tileType) =>
    Array.from({ length: tileType.count }, () => tileType)
  );
  if (tileTypePool.length !== coords.length) {
    throw new Error(
      `Ruleset "${ruleset.id}": board radius ${ruleset.board.radius} has ${coords.length} tiles ` +
        `but tileTypes counts add up to ${tileTypePool.length}.`
    );
  }
  const shuffledTileTypes = shuffle(rng, tileTypePool);

  const producingCount = shuffledTileTypes.filter((t) => t.resourceId !== null).length;
  if (ruleset.board.numberTokens.length !== producingCount) {
    throw new Error(
      `Ruleset "${ruleset.id}": ${producingCount} resource-producing tiles but ` +
        `${ruleset.board.numberTokens.length} number tokens configured.`
    );
  }
  const shuffledNumbers = shuffle(rng, ruleset.board.numberTokens);

  let numberIndex = 0;
  const tiles: Tile[] = coords.map((coord, i) => {
    const tileType = shuffledTileTypes[i];
    const numberToken = tileType.resourceId !== null ? shuffledNumbers[numberIndex++] : null;
    return {
      coord,
      tileTypeId: tileType.id,
      resourceId: tileType.resourceId,
      numberToken,
    };
  });

  return { radius: ruleset.board.radius, tiles };
}
