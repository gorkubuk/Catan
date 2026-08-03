import { axialKey } from "../board/types";
import type { BoardTopology, Vertex } from "../board/topology";
import { createRngCursor, randomInt, rollDice } from "../rng";
import { applyProduction, computeProduction } from "../production";
import type { BuildingCost, Ruleset } from "../ruleset/types";
import type { GameState, PlayerState, ResourceHand } from "../state/types";
import { currentPlayer, validateMove } from "./validate";
import type { Move } from "./types";

function mergeResources(hand: ResourceHand, gained: ResourceHand): ResourceHand {
  const result: ResourceHand = { ...hand };
  for (const [resourceId, amount] of Object.entries(gained)) {
    result[resourceId] = (result[resourceId] ?? 0) + amount;
  }
  return result;
}

function deductCost(hand: ResourceHand, cost: BuildingCost[]): ResourceHand {
  const result: ResourceHand = { ...hand };
  for (const c of cost) {
    result[c.resourceId] = (result[c.resourceId] ?? 0) - c.amount;
  }
  return result;
}

function updatePlayer(state: GameState, playerId: string, update: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? update(p) : p)) };
}

function recomputeVictoryPoints(ruleset: Ruleset, state: GameState, playerId: string): GameState {
  const buildingVp = new Map(ruleset.buildings.map((b) => [b.id, b.victoryPoints]));
  const devVp = new Map(ruleset.developmentCards.map((c) => [c.id, c.victoryPoints]));

  let newState = updatePlayer(state, playerId, (p) => {
    let vp = 0;
    for (const b of Object.values(state.buildings)) {
      if (b.ownerId === p.id) vp += buildingVp.get(b.buildingTypeId) ?? 0;
    }
    for (const [cardId, count] of Object.entries(p.developmentCards)) {
      vp += (devVp.get(cardId) ?? 0) * count;
    }
    return { ...p, victoryPoints: vp };
  });

  const player = newState.players.find((p) => p.id === playerId)!;
  if (player.victoryPoints >= ruleset.winCondition.targetVictoryPoints) {
    newState = { ...newState, phase: "game-over" };
  }
  return newState;
}

function grantInitialResources(topology: BoardTopology, state: GameState, vertexId: string, playerId: string): GameState {
  const vertex: Vertex | undefined = topology.vertices.get(vertexId);
  if (!vertex) return state;

  const gained: ResourceHand = {};
  for (const coord of vertex.tileCoords) {
    const tile = state.board.tiles.find((t) => axialKey(t.coord) === axialKey(coord));
    if (tile?.resourceId) gained[tile.resourceId] = (gained[tile.resourceId] ?? 0) + 1;
  }
  return updatePlayer(state, playerId, (p) => ({ ...p, resources: mergeResources(p.resources, gained) }));
}

function advanceSetupTurn(state: GameState): GameState {
  const n = state.players.length;
  if (state.phase === "setup-round-1") {
    if (state.currentPlayerIndex === n - 1) {
      return { ...state, phase: "setup-round-2", setupStep: "settlement", setupPendingVertexId: null };
    }
    return {
      ...state,
      currentPlayerIndex: state.currentPlayerIndex + 1,
      setupStep: "settlement",
      setupPendingVertexId: null,
    };
  }
  // setup-round-2
  if (state.currentPlayerIndex === 0) {
    return { ...state, phase: "awaiting-roll", setupStep: null, setupPendingVertexId: null };
  }
  return {
    ...state,
    currentPlayerIndex: state.currentPlayerIndex - 1,
    setupStep: "settlement",
    setupPendingVertexId: null,
  };
}

function applyPlaceSettlement(ruleset: Ruleset, topology: BoardTopology, state: GameState, playerId: string, vertexId: string): GameState {
  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";
  const settlementConfig = ruleset.buildings.find((b) => b.id === "settlement")!;

  let newState: GameState = {
    ...state,
    buildings: { ...state.buildings, [vertexId]: { ownerId: playerId, buildingTypeId: "settlement" } },
  };

  if (!isSetup) {
    newState = updatePlayer(newState, playerId, (p) => ({
      ...p,
      resources: deductCost(p.resources, settlementConfig.cost),
    }));
  }

  newState = recomputeVictoryPoints(ruleset, newState, playerId);

  if (isSetup) {
    newState = { ...newState, setupStep: "road", setupPendingVertexId: vertexId };
    if (state.phase === "setup-round-2") {
      newState = grantInitialResources(topology, newState, vertexId, playerId);
    }
  }

  return newState;
}

function applyPlaceRoad(ruleset: Ruleset, state: GameState, playerId: string, edgeId: string): GameState {
  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";
  const roadConfig = ruleset.buildings.find((b) => b.id === "road")!;

  let newState: GameState = { ...state, roads: { ...state.roads, [edgeId]: { ownerId: playerId } } };

  if (!isSetup) {
    newState = updatePlayer(newState, playerId, (p) => ({
      ...p,
      resources: deductCost(p.resources, roadConfig.cost),
    }));
  } else {
    newState = advanceSetupTurn(newState);
  }

  return newState;
}

function applyBuildCity(ruleset: Ruleset, state: GameState, playerId: string, vertexId: string): GameState {
  const cityConfig = ruleset.buildings.find((b) => b.id === "city")!;

  let newState: GameState = {
    ...state,
    buildings: { ...state.buildings, [vertexId]: { ownerId: playerId, buildingTypeId: "city" } },
  };
  newState = updatePlayer(newState, playerId, (p) => ({
    ...p,
    resources: deductCost(p.resources, cityConfig.cost),
  }));

  return recomputeVictoryPoints(ruleset, newState, playerId);
}

function applyRollDice(ruleset: Ruleset, topology: BoardTopology, state: GameState): GameState {
  const cursor = createRngCursor(state.rngState);
  const diceValues = rollDice(cursor, ruleset.dice.diceCount, ruleset.dice.sides);
  const total = diceValues.reduce((a, b) => a + b, 0);

  let newState: GameState = { ...state, rngState: cursor.state, lastDiceRoll: diceValues };

  if (ruleset.blockerMechanic.enabled && total === ruleset.blockerMechanic.triggerOnRollTotal) {
    // Note: the "discard half your hand above 7 cards" rule some rulesets pair
    // with this roll is not implemented yet — deliberately left for later.
    newState = { ...newState, phase: "blocker-resolution" };
  } else {
    const production = computeProduction(ruleset, topology, newState, total);
    newState = applyProduction(newState, production);
    newState = { ...newState, phase: "main" };
  }

  return newState;
}

function applyMoveBlocker(
  state: GameState,
  tileCoord: { q: number; r: number },
  stealFromPlayerId: string | undefined
): GameState {
  let newState: GameState = { ...state, blockerTileKey: axialKey(tileCoord) };

  if (stealFromPlayerId) {
    const cursor = createRngCursor(state.rngState);
    const target = state.players.find((p) => p.id === stealFromPlayerId)!;
    const pool: string[] = [];
    for (const [resourceId, amount] of Object.entries(target.resources)) {
      for (let i = 0; i < amount; i++) pool.push(resourceId);
    }
    const stolenResource = pool[randomInt(cursor, 0, pool.length - 1)];
    const thiefId = currentPlayer(state).id;

    newState = updatePlayer(newState, target.id, (p) => ({
      ...p,
      resources: { ...p.resources, [stolenResource]: (p.resources[stolenResource] ?? 0) - 1 },
    }));
    newState = updatePlayer(newState, thiefId, (p) => ({
      ...p,
      resources: { ...p.resources, [stolenResource]: (p.resources[stolenResource] ?? 0) + 1 },
    }));
    newState = { ...newState, rngState: cursor.state };
  }

  return { ...newState, phase: "main" };
}

function applyEndTurn(state: GameState): GameState {
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: "awaiting-roll",
    lastDiceRoll: null,
    turnNumber: state.turnNumber + 1,
  };
}

/**
 * Single entry point for advancing game state. Client and server must both
 * run moves through this same function (client optimistically, server
 * authoritatively) so they can never disagree on the rules.
 */
export function applyMove(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  move: Move
): GameState {
  const result = validateMove(ruleset, topology, state, playerId, move);
  if (!result.ok) {
    throw new Error(result.reason ?? "Invalid move.");
  }

  switch (move.type) {
    case "PLACE_SETTLEMENT":
      return applyPlaceSettlement(ruleset, topology, state, playerId, move.vertexId);
    case "PLACE_ROAD":
      return applyPlaceRoad(ruleset, state, playerId, move.edgeId);
    case "BUILD_CITY":
      return applyBuildCity(ruleset, state, playerId, move.vertexId);
    case "ROLL_DICE":
      return applyRollDice(ruleset, topology, state);
    case "MOVE_BLOCKER":
      return applyMoveBlocker(state, move.tileCoord, move.stealFromPlayerId);
    case "END_TURN":
      return applyEndTurn(state);
  }
}
