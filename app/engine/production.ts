import { axialKey } from "./board/types";
import type { BoardTopology } from "./board/topology";
import type { Ruleset } from "./ruleset/types";
import type { GameState, ResourceHand } from "./state/types";

/** playerId -> resourceId -> amount gained from this dice roll. */
export type ProductionResult = Record<string, ResourceHand>;

export function computeProduction(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  diceTotal: number
): ProductionResult {
  const buildingMultiplier = new Map(ruleset.buildings.map((b) => [b.id, b.resourceMultiplier]));
  const result: ProductionResult = {};
  for (const player of state.players) {
    result[player.id] = {};
  }

  for (const tile of state.board.tiles) {
    if (tile.numberToken !== diceTotal) continue;
    if (tile.resourceId === null) continue;
    if (state.blockerTileKey !== null && axialKey(tile.coord) === state.blockerTileKey) continue;

    for (const vertex of topology.vertices.values()) {
      const touchesTile = vertex.tileCoords.some((c) => axialKey(c) === axialKey(tile.coord));
      if (!touchesTile) continue;

      const building = state.buildings[vertex.id];
      if (!building) continue;

      const multiplier = buildingMultiplier.get(building.buildingTypeId) ?? 0;
      if (multiplier <= 0) continue;

      const hand = result[building.ownerId];
      hand[tile.resourceId] = (hand[tile.resourceId] ?? 0) + multiplier;
    }
  }

  return result;
}

export function applyProduction(state: GameState, production: ProductionResult): GameState {
  const players = state.players.map((player) => {
    const gained = production[player.id];
    if (!gained) return player;
    const resources: ResourceHand = { ...player.resources };
    for (const [resourceId, amount] of Object.entries(gained)) {
      resources[resourceId] = (resources[resourceId] ?? 0) + amount;
    }
    return { ...player, resources };
  });
  return { ...state, players };
}
