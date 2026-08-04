import { createRngCursor, shuffle } from "../rng";
import { generateBoard } from "../board/generateBoard";
import { axialKey } from "../board/types";
import type { Ruleset } from "../ruleset/types";
import type { GameState, PlayerState } from "./types";

export interface PlayerInfo {
  id: string;
  displayName: string;
}

function emptyResourceHand(ruleset: Ruleset): Record<string, number> {
  return Object.fromEntries(ruleset.resources.map((r) => [r.id, 0]));
}

function emptyDevCardHand(ruleset: Ruleset): Record<string, number> {
  return Object.fromEntries(ruleset.developmentCards.map((c) => [c.id, 0]));
}

export function createGame(ruleset: Ruleset, seed: string, playerInfos: PlayerInfo[]): GameState {
  if (playerInfos.length < ruleset.minPlayers || playerInfos.length > ruleset.maxPlayers) {
    throw new Error(
      `Ruleset "${ruleset.id}" requires ${ruleset.minPlayers}-${ruleset.maxPlayers} players, got ${playerInfos.length}.`
    );
  }

  const rng = createRngCursor(seed);
  const board = generateBoard(ruleset, rng);

  const developmentCardPool = ruleset.developmentCards.flatMap((card) =>
    Array.from({ length: card.count }, () => card.id)
  );
  const developmentCardDeck = shuffle(rng, developmentCardPool);

  const players: PlayerState[] = playerInfos.map((info) => ({
    id: info.id,
    displayName: info.displayName,
    resources: emptyResourceHand(ruleset),
    developmentCards: emptyDevCardHand(ruleset),
    victoryPoints: 0,
    soldiersPlayed: 0,
  }));

  const nonProducingTile = board.tiles.find((t) => t.resourceId === null);
  const blockerTileKey =
    ruleset.blockerMechanic.enabled && nonProducingTile ? axialKey(nonProducingTile.coord) : null;

  return {
    rulesetId: ruleset.id,
    rngSeed: seed,
    rngState: rng.state,
    board,
    players,
    currentPlayerIndex: 0,
    phase: "setup-round-1",
    setupStep: "settlement",
    setupPendingVertexId: null,
    buildings: {},
    roads: {},
    blockerTileKey,
    turnNumber: 1,
    lastDiceRoll: null,
    developmentCardDeck,
    playersAwaitingDiscard: [],
  };
}
