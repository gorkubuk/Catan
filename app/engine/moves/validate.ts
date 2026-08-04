import { axialKey } from "../board/types";
import type { BoardTopology } from "../board/topology";
import type { BuildingCost, Ruleset } from "../ruleset/types";
import type { GameState, PlayerState, ResourceHand } from "../state/types";
import type { Move, MoveResult } from "./types";

const ok: MoveResult = { ok: true };
function fail(reason: string): MoveResult {
  return { ok: false, reason };
}

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function totalResources(hand: ResourceHand): number {
  return Object.values(hand).reduce((a, b) => a + b, 0);
}

function hasEnoughResources(player: PlayerState, cost: BuildingCost[]): boolean {
  return cost.every((c) => (player.resources[c.resourceId] ?? 0) >= c.amount);
}

function countPlacedByPlayer(state: GameState, playerId: string, buildingTypeId: string): number {
  let count = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.ownerId === playerId && b.buildingTypeId === buildingTypeId) count++;
  }
  return count;
}

function vertexHasNoAdjacentBuilding(topology: BoardTopology, state: GameState, vertexId: string): boolean {
  const neighbors = topology.vertexNeighbors.get(vertexId) ?? [];
  return neighbors.every((n) => !state.buildings[n]);
}

function vertexTouchesOwnedRoad(
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  vertexId: string
): boolean {
  const edgeIds = topology.vertexEdges.get(vertexId) ?? [];
  return edgeIds.some((e) => state.roads[e]?.ownerId === playerId);
}

function edgeTouchesOwnedNetwork(
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  edgeId: string,
  extraOwnedEdgeIds: string[] = []
): boolean {
  const edge = topology.edges.get(edgeId);
  if (!edge) return false;
  return edge.vertexIds.some((v) => {
    const building = state.buildings[v];
    if (building && building.ownerId === playerId) return true;
    const touchingEdges = topology.vertexEdges.get(v) ?? [];
    return touchingEdges.some(
      (e2) => e2 !== edgeId && (state.roads[e2]?.ownerId === playerId || extraOwnedEdgeIds.includes(e2))
    );
  });
}

function validateBlockerTarget(
  ruleset: Ruleset,
  state: GameState,
  tileCoord: { q: number; r: number },
  stealFromPlayerId: string | undefined
): MoveResult {
  if (!ruleset.blockerMechanic.enabled) return fail("Blocker mechanic is disabled in this ruleset.");

  const key = axialKey(tileCoord);
  if (!state.board.tiles.some((t) => axialKey(t.coord) === key)) return fail("Tile is not on this board.");
  if (key === state.blockerTileKey) return fail("Blocker is already on that tile.");

  if (stealFromPlayerId) {
    const target = state.players.find((p) => p.id === stealFromPlayerId);
    if (!target) return fail("Target player does not exist.");
    if (totalResources(target.resources) === 0) return fail("Target player has no resources to steal.");
  }

  return ok;
}

export function validatePlaceSettlement(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  vertexId: string
): MoveResult {
  if (!topology.vertices.has(vertexId)) return fail("Vertex does not exist on this board.");
  if (state.buildings[vertexId]) return fail("Vertex is already occupied.");
  if (!vertexHasNoAdjacentBuilding(topology, state, vertexId)) {
    return fail("Too close to another settlement or city (distance rule).");
  }

  const settlementConfig = ruleset.buildings.find((b) => b.id === "settlement");
  if (!settlementConfig) return fail('Ruleset has no "settlement" building type.');
  if (countPlacedByPlayer(state, playerId, "settlement") >= settlementConfig.maxPerPlayer) {
    return fail("No settlement pieces left.");
  }

  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";
  if (!isSetup) {
    if (state.phase !== "main") return fail(`Cannot build during phase "${state.phase}".`);
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !hasEnoughResources(player, settlementConfig.cost)) {
      return fail("Not enough resources for a settlement.");
    }
    if (!vertexTouchesOwnedRoad(topology, state, playerId, vertexId)) {
      return fail("Settlement must connect to one of your own roads.");
    }
  }

  return ok;
}

export function validatePlaceRoad(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  edgeId: string
): MoveResult {
  if (!topology.edges.has(edgeId)) return fail("Edge does not exist on this board.");
  if (state.roads[edgeId]) return fail("Edge already has a road.");

  const roadConfig = ruleset.buildings.find((b) => b.id === "road");
  if (!roadConfig) return fail('Ruleset has no "road" building type.');
  if (countPlacedByPlayer(state, playerId, "road") >= roadConfig.maxPerPlayer) {
    return fail("No road pieces left.");
  }

  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";
  if (isSetup) {
    if (state.setupStep !== "road") return fail("Place a settlement before this road.");
    if (!state.setupPendingVertexId) return fail("No pending settlement to connect.");
    const edge = topology.edges.get(edgeId)!;
    if (!edge.vertexIds.includes(state.setupPendingVertexId)) {
      return fail("Road must connect directly to the settlement you just placed.");
    }
  } else {
    if (state.phase !== "main") return fail(`Cannot build during phase "${state.phase}".`);
    const player = state.players.find((p) => p.id === playerId);
    if (!player || !hasEnoughResources(player, roadConfig.cost)) {
      return fail("Not enough resources for a road.");
    }
    if (!edgeTouchesOwnedNetwork(topology, state, playerId, edgeId)) {
      return fail("Road must connect to your existing roads or a building.");
    }
  }

  return ok;
}

export function validateBuildCity(
  ruleset: Ruleset,
  state: GameState,
  playerId: string,
  vertexId: string
): MoveResult {
  if (state.phase !== "main") return fail(`Cannot build during phase "${state.phase}".`);

  const existing = state.buildings[vertexId];
  if (!existing || existing.ownerId !== playerId || existing.buildingTypeId !== "settlement") {
    return fail("City must be built on top of your own settlement.");
  }

  const cityConfig = ruleset.buildings.find((b) => b.id === "city");
  if (!cityConfig) return fail('Ruleset has no "city" building type.');
  if (countPlacedByPlayer(state, playerId, "city") >= cityConfig.maxPerPlayer) {
    return fail("No city pieces left.");
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !hasEnoughResources(player, cityConfig.cost)) {
    return fail("Not enough resources for a city.");
  }

  return ok;
}

export function validateRollDice(state: GameState): MoveResult {
  if (state.phase !== "awaiting-roll") return fail(`Cannot roll dice during phase "${state.phase}".`);
  return ok;
}

export function validateMoveBlocker(
  ruleset: Ruleset,
  state: GameState,
  tileCoord: { q: number; r: number },
  stealFromPlayerId: string | undefined
): MoveResult {
  if (state.phase !== "blocker-resolution") return fail(`Cannot move the blocker during phase "${state.phase}".`);
  return validateBlockerTarget(ruleset, state, tileCoord, stealFromPlayerId);
}

export function validateDiscardResources(
  ruleset: Ruleset,
  state: GameState,
  playerId: string,
  resources: ResourceHand
): MoveResult {
  if (state.phase !== "discard") return fail(`Cannot discard during phase "${state.phase}".`);
  if (!state.playersAwaitingDiscard.includes(playerId)) return fail("This player owes no discard right now.");

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return fail("Player does not exist.");

  const requiredDiscard = Math.floor(totalResources(player.resources) / 2);
  const offered = totalResources(resources);
  if (offered !== requiredDiscard) {
    return fail(`Must discard exactly ${requiredDiscard} cards, offered ${offered}.`);
  }
  for (const [resourceId, amount] of Object.entries(resources)) {
    if (amount < 0) return fail("Cannot discard a negative amount.");
    if ((player.resources[resourceId] ?? 0) < amount) return fail("Cannot discard resources you do not have.");
  }
  void ruleset;
  return ok;
}

export function validateTradeWithBank(
  ruleset: Ruleset,
  state: GameState,
  playerId: string,
  giveResourceId: string,
  giveAmount: number,
  receiveResourceId: string
): MoveResult {
  if (state.phase !== "main") return fail(`Cannot trade during phase "${state.phase}".`);
  if (giveResourceId === receiveResourceId) return fail("Cannot trade a resource for itself.");
  if (giveAmount !== ruleset.bankTradeRatio) return fail(`Bank trades must give exactly ${ruleset.bankTradeRatio}.`);
  if (!ruleset.resources.some((r) => r.id === receiveResourceId)) return fail("Unknown resource to receive.");

  const player = state.players.find((p) => p.id === playerId);
  if (!player || (player.resources[giveResourceId] ?? 0) < giveAmount) {
    return fail("Not enough resources for this trade.");
  }
  return ok;
}

export function validateBuyDevelopmentCard(ruleset: Ruleset, state: GameState, playerId: string): MoveResult {
  if (state.phase !== "main") return fail(`Cannot buy a development card during phase "${state.phase}".`);
  if (state.developmentCardDeck.length === 0) return fail("Development card deck is empty.");

  const player = state.players.find((p) => p.id === playerId);
  if (!player || !hasEnoughResources(player, ruleset.developmentCardCost)) {
    return fail("Not enough resources to buy a development card.");
  }
  return ok;
}

export function validatePlayDevelopmentCard(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  move: Extract<Move, { type: "PLAY_DEVELOPMENT_CARD" }>
): MoveResult {
  if (state.phase !== "main") return fail(`Cannot play a development card during phase "${state.phase}".`);

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return fail("Player does not exist.");
  if ((player.developmentCards[move.cardId] ?? 0) < 1) return fail(`No ${move.cardId} card to play.`);

  switch (move.cardId) {
    case "soldier":
      return validateBlockerTarget(ruleset, state, move.tileCoord, move.stealFromPlayerId);
    case "trade-monopoly":
      if (!ruleset.resources.some((r) => r.id === move.resourceId)) return fail("Unknown resource.");
      return ok;
    case "path-builder": {
      const roadConfig = ruleset.buildings.find((b) => b.id === "road")!;
      if (countPlacedByPlayer(state, playerId, "road") + 2 > roadConfig.maxPerPlayer) {
        return fail("Not enough road pieces left for 2 free roads.");
      }
      const [edgeA, edgeB] = move.edgeIds;
      if (edgeA === edgeB) return fail("Must choose two different edges.");
      if (!topology.edges.has(edgeA) || !topology.edges.has(edgeB)) return fail("Edge does not exist on this board.");
      if (state.roads[edgeA] || state.roads[edgeB]) return fail("One of those edges already has a road.");
      if (!edgeTouchesOwnedNetwork(topology, state, playerId, edgeA)) {
        return fail("First free road must connect to your existing network.");
      }
      if (!edgeTouchesOwnedNetwork(topology, state, playerId, edgeB, [edgeA])) {
        return fail("Second free road must connect to your network or the first free road.");
      }
      return ok;
    }
    case "harvest":
      if (move.resourceIds.some((id) => !ruleset.resources.some((r) => r.id === id))) {
        return fail("Unknown resource.");
      }
      return ok;
  }
}

export function validateEndTurn(state: GameState): MoveResult {
  if (state.phase !== "main") return fail(`Cannot end turn during phase "${state.phase}".`);
  return ok;
}

export function validateMove(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  move: Move
): MoveResult {
  if (move.type === "DISCARD_RESOURCES") {
    return validateDiscardResources(ruleset, state, playerId, move.resources);
  }

  const isCurrentPlayer = currentPlayer(state).id === playerId;
  if (!isCurrentPlayer) return fail("It is not this player's turn.");

  switch (move.type) {
    case "PLACE_SETTLEMENT":
      return validatePlaceSettlement(ruleset, topology, state, playerId, move.vertexId);
    case "PLACE_ROAD":
      return validatePlaceRoad(ruleset, topology, state, playerId, move.edgeId);
    case "BUILD_CITY":
      return validateBuildCity(ruleset, state, playerId, move.vertexId);
    case "ROLL_DICE":
      return validateRollDice(state);
    case "MOVE_BLOCKER":
      return validateMoveBlocker(ruleset, state, move.tileCoord, move.stealFromPlayerId);
    case "TRADE_WITH_BANK":
      return validateTradeWithBank(ruleset, state, playerId, move.giveResourceId, move.giveAmount, move.receiveResourceId);
    case "BUY_DEVELOPMENT_CARD":
      return validateBuyDevelopmentCard(ruleset, state, playerId);
    case "PLAY_DEVELOPMENT_CARD":
      return validatePlayDevelopmentCard(ruleset, topology, state, playerId, move);
    case "END_TURN":
      return validateEndTurn(state);
  }
}
