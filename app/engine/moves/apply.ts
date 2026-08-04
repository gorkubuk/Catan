import { axialKey } from "../board/types";
import type { AxialCoord } from "../board/types";
import type { BoardTopology, Vertex } from "../board/topology";
import { createRngCursor, randomInt, rollDice } from "../rng";
import { applyProduction, computeProduction } from "../production";
import { recomputeAll } from "../scoring";
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

function moveBlockerAndSteal(
  state: GameState,
  tileCoord: AxialCoord,
  stealFromPlayerId: string | undefined,
  thiefId: string
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

  newState = recomputeAll(ruleset, topology, newState);

  if (isSetup) {
    newState = { ...newState, setupStep: "road", setupPendingVertexId: vertexId };
    if (state.phase === "setup-round-2") {
      newState = grantInitialResources(topology, newState, vertexId, playerId);
    }
  }

  return newState;
}

function applyPlaceRoad(ruleset: Ruleset, topology: BoardTopology, state: GameState, playerId: string, edgeId: string): GameState {
  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";
  const roadConfig = ruleset.buildings.find((b) => b.id === "road")!;

  let newState: GameState = { ...state, roads: { ...state.roads, [edgeId]: { ownerId: playerId } } };

  if (!isSetup) {
    newState = updatePlayer(newState, playerId, (p) => ({
      ...p,
      resources: deductCost(p.resources, roadConfig.cost),
    }));
  }

  newState = recomputeAll(ruleset, topology, newState);

  if (isSetup) {
    newState = advanceSetupTurn(newState);
  }

  return newState;
}

function applyBuildCity(ruleset: Ruleset, topology: BoardTopology, state: GameState, playerId: string, vertexId: string): GameState {
  const cityConfig = ruleset.buildings.find((b) => b.id === "city")!;

  let newState: GameState = {
    ...state,
    buildings: { ...state.buildings, [vertexId]: { ownerId: playerId, buildingTypeId: "city" } },
  };
  newState = updatePlayer(newState, playerId, (p) => ({
    ...p,
    resources: deductCost(p.resources, cityConfig.cost),
  }));

  return recomputeAll(ruleset, topology, newState);
}

function applyRollDice(ruleset: Ruleset, topology: BoardTopology, state: GameState): GameState {
  const cursor = createRngCursor(state.rngState);
  const diceValues = rollDice(cursor, ruleset.dice.diceCount, ruleset.dice.sides);
  const total = diceValues.reduce((a, b) => a + b, 0);

  let newState: GameState = { ...state, rngState: cursor.state, lastDiceRoll: diceValues };

  if (ruleset.blockerMechanic.enabled && total === ruleset.blockerMechanic.triggerOnRollTotal) {
    const playersAwaitingDiscard = newState.players
      .filter((p) => Object.values(p.resources).reduce((a, b) => a + b, 0) > ruleset.discardThreshold)
      .map((p) => p.id);
    newState =
      playersAwaitingDiscard.length > 0
        ? { ...newState, phase: "discard", playersAwaitingDiscard }
        : { ...newState, phase: "blocker-resolution" };
  } else {
    const production = computeProduction(ruleset, topology, newState, total);
    newState = applyProduction(newState, production);
    newState = { ...newState, phase: "main" };
  }

  return newState;
}

function applyMoveBlocker(state: GameState, tileCoord: AxialCoord, stealFromPlayerId: string | undefined): GameState {
  const thiefId = currentPlayer(state).id;
  const newState = moveBlockerAndSteal(state, tileCoord, stealFromPlayerId, thiefId);
  return { ...newState, phase: "main" };
}

function applyDiscardResources(state: GameState, playerId: string, resources: ResourceHand): GameState {
  let newState = updatePlayer(state, playerId, (p) => ({
    ...p,
    resources: deductCost(p.resources, Object.entries(resources).map(([resourceId, amount]) => ({ resourceId, amount }))),
  }));
  const playersAwaitingDiscard = newState.playersAwaitingDiscard.filter((id) => id !== playerId);
  newState = { ...newState, playersAwaitingDiscard };
  if (playersAwaitingDiscard.length === 0) {
    newState = { ...newState, phase: "blocker-resolution" };
  }
  return newState;
}

function applyTradeWithBank(
  state: GameState,
  playerId: string,
  giveResourceId: string,
  giveAmount: number,
  receiveResourceId: string
): GameState {
  return updatePlayer(state, playerId, (p) => {
    const resources = { ...p.resources };
    resources[giveResourceId] = (resources[giveResourceId] ?? 0) - giveAmount;
    resources[receiveResourceId] = (resources[receiveResourceId] ?? 0) + 1;
    return { ...p, resources };
  });
}

function applyBuyDevelopmentCard(ruleset: Ruleset, topology: BoardTopology, state: GameState, playerId: string): GameState {
  const cardId = state.developmentCardDeck[0];
  let newState: GameState = { ...state, developmentCardDeck: state.developmentCardDeck.slice(1) };
  newState = updatePlayer(newState, playerId, (p) => ({
    ...p,
    resources: deductCost(p.resources, ruleset.developmentCardCost),
    developmentCards: { ...p.developmentCards, [cardId]: (p.developmentCards[cardId] ?? 0) + 1 },
  }));
  return recomputeAll(ruleset, topology, newState);
}

function spendDevelopmentCard(state: GameState, playerId: string, cardId: string): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    developmentCards: { ...p.developmentCards, [cardId]: (p.developmentCards[cardId] ?? 0) - 1 },
  }));
}

function applyPlayDevelopmentCard(
  ruleset: Ruleset,
  topology: BoardTopology,
  state: GameState,
  playerId: string,
  move: Extract<Move, { type: "PLAY_DEVELOPMENT_CARD" }>
): GameState {
  let newState = spendDevelopmentCard(state, playerId, move.cardId);

  switch (move.cardId) {
    case "soldier": {
      newState = moveBlockerAndSteal(newState, move.tileCoord, move.stealFromPlayerId, playerId);
      newState = updatePlayer(newState, playerId, (p) => ({ ...p, soldiersPlayed: p.soldiersPlayed + 1 }));
      return recomputeAll(ruleset, topology, newState);
    }
    case "trade-monopoly": {
      let total = 0;
      newState = {
        ...newState,
        players: newState.players.map((p) => {
          if (p.id === playerId) return p;
          const amount = p.resources[move.resourceId] ?? 0;
          total += amount;
          return { ...p, resources: { ...p.resources, [move.resourceId]: 0 } };
        }),
      };
      newState = updatePlayer(newState, playerId, (p) => ({
        ...p,
        resources: { ...p.resources, [move.resourceId]: (p.resources[move.resourceId] ?? 0) + total },
      }));
      return newState;
    }
    case "path-builder": {
      const [edgeA, edgeB] = move.edgeIds;
      newState = {
        ...newState,
        roads: {
          ...newState.roads,
          [edgeA]: { ownerId: playerId },
          [edgeB]: { ownerId: playerId },
        },
      };
      return recomputeAll(ruleset, topology, newState);
    }
    case "harvest": {
      const gained: ResourceHand = {};
      for (const resourceId of move.resourceIds) {
        gained[resourceId] = (gained[resourceId] ?? 0) + 1;
      }
      return updatePlayer(newState, playerId, (p) => ({ ...p, resources: mergeResources(p.resources, gained) }));
    }
  }
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
      return applyPlaceRoad(ruleset, topology, state, playerId, move.edgeId);
    case "BUILD_CITY":
      return applyBuildCity(ruleset, topology, state, playerId, move.vertexId);
    case "ROLL_DICE":
      return applyRollDice(ruleset, topology, state);
    case "MOVE_BLOCKER":
      return applyMoveBlocker(state, move.tileCoord, move.stealFromPlayerId);
    case "DISCARD_RESOURCES":
      return applyDiscardResources(state, playerId, move.resources);
    case "TRADE_WITH_BANK":
      return applyTradeWithBank(state, playerId, move.giveResourceId, move.giveAmount, move.receiveResourceId);
    case "BUY_DEVELOPMENT_CARD":
      return applyBuyDevelopmentCard(ruleset, topology, state, playerId);
    case "PLAY_DEVELOPMENT_CARD":
      return applyPlayDevelopmentCard(ruleset, topology, state, playerId, move);
    case "END_TURN":
      return applyEndTurn(state);
  }
}
