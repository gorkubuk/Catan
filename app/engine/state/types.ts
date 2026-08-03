import type { Board } from "../board/types";

export type ResourceHand = Record<string, number>;

export interface PlayerState {
  id: string;
  displayName: string;
  resources: ResourceHand;
  /** Building id -> number of that building this player has placed. */
  buildingsPlaced: Record<string, number>;
  developmentCards: Record<string, number>;
  victoryPoints: number;
}

export type GamePhase = "setup" | "awaiting-roll" | "main" | "blocker-resolution" | "game-over";

export interface GameState {
  rulesetId: string;
  rngSeed: string;
  board: Board;
  players: PlayerState[];
  currentPlayerIndex: number;
  phase: GamePhase;
  /** Axial coord key (see axialKey) of the tile currently holding the blocker piece, if the mechanic is enabled. */
  blockerTileKey: string | null;
  turnNumber: number;
}
