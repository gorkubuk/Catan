/**
 * A Ruleset fully describes one playable game: board shape, resources,
 * costs, and win condition. The engine core must never hardcode any of
 * this — only ever read it from a Ruleset — so the same engine can run
 * a different game by swapping the config.
 */

export interface ResourceTypeConfig {
  id: string;
  displayName: string;
}

/** One tile kind on the board, e.g. produces a resource, or produces nothing (desert-equivalent). */
export interface TileTypeConfig {
  id: string;
  displayName: string;
  resourceId: string | null;
  count: number;
}

export interface BuildingCost {
  resourceId: string;
  amount: number;
}

export interface BuildingTypeConfig {
  id: string;
  displayName: string;
  cost: BuildingCost[];
  victoryPoints: number;
  /** How many of this building each player may place before running out of pieces. */
  maxPerPlayer: number;
  /** Resource units this building produces per matching dice roll, per adjacent tile. */
  resourceMultiplier: number;
}

export interface DevelopmentCardConfig {
  id: string;
  displayName: string;
  count: number;
  victoryPoints: number;
}

export interface DiceConfig {
  diceCount: number;
  sides: number;
}

/** The Catan-equivalent "roll 7, move the blocking piece" mechanic, generalized. */
export interface BlockerMechanicConfig {
  enabled: boolean;
  displayName: string;
  triggerOnRollTotal: number;
}

export interface BonusBadgeConfig {
  id: string;
  displayName: string;
  victoryPoints: number;
  minimumToQualify: number;
}

export interface BoardLayoutConfig {
  /** Radius of the hex board in rings from center (1 = just the center tile). */
  radius: number;
  tileTypes: TileTypeConfig[];
  /** Number tokens assigned to resource-producing tiles, drawn without replacement. */
  numberTokens: number[];
}

export interface WinConditionConfig {
  targetVictoryPoints: number;
}

export interface Ruleset {
  id: string;
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  resources: ResourceTypeConfig[];
  board: BoardLayoutConfig;
  buildings: BuildingTypeConfig[];
  developmentCards: DevelopmentCardConfig[];
  /** Flat cost to draw a development card, regardless of which one comes up. */
  developmentCardCost: BuildingCost[];
  dice: DiceConfig;
  blockerMechanic: BlockerMechanicConfig;
  bonusBadges: BonusBadgeConfig[];
  winCondition: WinConditionConfig;
  /** Units of one resource a player must give the bank for 1 unit of another, with no port. */
  bankTradeRatio: number;
  /** Total resource cards a hand may hold when the blocker mechanic triggers before discarding half (rounded down). */
  discardThreshold: number;
}
