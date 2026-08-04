import { useCallback, useMemo, useState } from "react";
import { computeBoardTopology } from "../engine/board/topology";
import { applyMove } from "../engine/moves/apply";
import { validateMove } from "../engine/moves/validate";
import type { Move } from "../engine/moves/types";
import type { Ruleset } from "../engine/ruleset/types";
import type { GameState } from "../engine/state/types";

export function useGameEngine(ruleset: Ruleset, initialState: GameState) {
  const [state, setState] = useState(initialState);
  const [lastError, setLastError] = useState<string | null>(null);
  const topology = useMemo(() => computeBoardTopology(state.board), [state.board]);

  const perform = useCallback(
    (playerId: string, move: Move) => {
      const result = validateMove(ruleset, topology, state, playerId, move);
      if (!result.ok) {
        setLastError(result.reason ?? "Invalid move.");
        return false;
      }
      setLastError(null);
      setState(applyMove(ruleset, topology, state, playerId, move));
      return true;
    },
    [ruleset, topology, state]
  );

  const resetGame = useCallback((next: GameState) => {
    setState(next);
    setLastError(null);
  }, []);

  return { state, topology, lastError, perform, resetGame };
}
