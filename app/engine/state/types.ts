import type { Board } from "../board/types";

export type ResourceHand = Record<string, number>;

export interface PlayerState {
  id: string;
  displayName: string;
  resources: ResourceHand;
  developmentCards: Record<string, number>;
  victoryPoints: number;
  soldiersPlayed: number;
}

export type GamePhase =
  | "setup-round-1"
  | "setup-round-2"
  | "awaiting-roll"
  | "main"
  | "discard"
  | "blocker-resolution"
  | "game-over";

/** During setup, each player places one settlement, then one connected road, before play passes on. */
export type SetupStep = "settlement" | "road" | null;

export interface SettlementOrCity {
  ownerId: string;
  /** Ruleset building id, e.g. "settlement" or "city". */
  buildingTypeId: string;
}

export interface RoadPiece {
  ownerId: string;
}

export interface GameState {
  rulesetId: string;
  /** Original seed string, kept for auditing/replay provenance. */
  rngSeed: string;
  /** Current numeric RNG state — advances with every roll/shuffle. Serializable. */
  rngState: number;
  board: Board;
  players: PlayerState[];
  currentPlayerIndex: number;
  phase: GamePhase;
  setupStep: SetupStep;
  /** Vertex placed this setup step, awaiting its connecting road. Null outside setup. */
  setupPendingVertexId: string | null;
  /** vertexId -> building placed there. */
  buildings: Record<string, SettlementOrCity>;
  /** edgeId -> road placed there. */
  roads: Record<string, RoadPiece>;
  /** Axial coord key (see axialKey) of the tile currently holding the blocker piece, if the mechanic is enabled. */
  blockerTileKey: string | null;
  turnNumber: number;
  lastDiceRoll: number[] | null;
  /** Remaining development cards, shuffled; index 0 is the top of the deck. */
  developmentCardDeck: string[];
  /** Player ids still owing a discard during phase "discard". */
  playersAwaitingDiscard: string[];
}
