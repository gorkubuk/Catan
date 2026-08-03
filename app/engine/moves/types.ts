import type { AxialCoord } from "../board/types";

export type Move =
  | { type: "PLACE_SETTLEMENT"; vertexId: string }
  | { type: "PLACE_ROAD"; edgeId: string }
  | { type: "BUILD_CITY"; vertexId: string }
  | { type: "ROLL_DICE" }
  | { type: "MOVE_BLOCKER"; tileCoord: AxialCoord; stealFromPlayerId?: string }
  | { type: "END_TURN" };

export interface MoveResult {
  ok: boolean;
  reason?: string;
}
