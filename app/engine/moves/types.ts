import type { AxialCoord } from "../board/types";
import type { ResourceHand } from "../state/types";

export type PlayDevelopmentCardMove =
  | { type: "PLAY_DEVELOPMENT_CARD"; cardId: "soldier"; tileCoord: AxialCoord; stealFromPlayerId?: string }
  | { type: "PLAY_DEVELOPMENT_CARD"; cardId: "trade-monopoly"; resourceId: string }
  | { type: "PLAY_DEVELOPMENT_CARD"; cardId: "path-builder"; edgeIds: [string, string] }
  | { type: "PLAY_DEVELOPMENT_CARD"; cardId: "harvest"; resourceIds: [string, string] };

export type Move =
  | { type: "PLACE_SETTLEMENT"; vertexId: string }
  | { type: "PLACE_ROAD"; edgeId: string }
  | { type: "BUILD_CITY"; vertexId: string }
  | { type: "ROLL_DICE" }
  | { type: "MOVE_BLOCKER"; tileCoord: AxialCoord; stealFromPlayerId?: string }
  | { type: "DISCARD_RESOURCES"; resources: ResourceHand }
  | { type: "TRADE_WITH_BANK"; giveResourceId: string; giveAmount: number; receiveResourceId: string }
  | { type: "BUY_DEVELOPMENT_CARD" }
  | PlayDevelopmentCardMove
  | { type: "END_TURN" };

export interface MoveResult {
  ok: boolean;
  reason?: string;
}
