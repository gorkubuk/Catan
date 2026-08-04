import type { BoardTopology } from "./board/topology";
import type { Ruleset } from "./ruleset/types";
import type { GameState } from "./state/types";

/**
 * Longest simple trail (no repeated road segment) through a player's own
 * roads. Small board (<= ~15 roads/player) so brute-force DFS is plenty fast.
 * Simplification: does not account for the network being "cut" by an
 * opponent's settlement sitting on a shared vertex.
 */
export function longestRoadLength(topology: BoardTopology, state: GameState, playerId: string): number {
  const ownedEdgeIds = Object.entries(state.roads)
    .filter(([, road]) => road.ownerId === playerId)
    .map(([edgeId]) => edgeId);
  if (ownedEdgeIds.length === 0) return 0;

  const adjacency = new Map<string, { edgeId: string; other: string }[]>();
  for (const edgeId of ownedEdgeIds) {
    const edge = topology.edges.get(edgeId)!;
    const [a, b] = edge.vertexIds;
    adjacency.set(a, [...(adjacency.get(a) ?? []), { edgeId, other: b }]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), { edgeId, other: a }]);
  }

  let best = 0;
  const usedEdges = new Set<string>();
  function dfs(vertex: string, depth: number): void {
    best = Math.max(best, depth);
    for (const { edgeId, other } of adjacency.get(vertex) ?? []) {
      if (usedEdges.has(edgeId)) continue;
      usedEdges.add(edgeId);
      dfs(other, depth + 1);
      usedEdges.delete(edgeId);
    }
  }
  for (const vertex of adjacency.keys()) dfs(vertex, 0);

  return best;
}

/**
 * Recomputes every player's victory points from scratch — base building/dev
 * card points plus whichever bonus badges they currently hold — and flips
 * the game to "game-over" if anyone has crossed the win condition. Always
 * recomputed globally (never incrementally) because a badge can change
 * hands based on what *any* player just did, not just the mover.
 * Simplification: ties for a badge mean nobody holds it (no "keeps the lead
 * on a tie" rule), and multiple simultaneous winners resolve to the first
 * one in player order.
 */
export function recomputeAll(ruleset: Ruleset, topology: BoardTopology, state: GameState): GameState {
  const buildingVp = new Map(ruleset.buildings.map((b) => [b.id, b.victoryPoints]));
  const devVp = new Map(ruleset.developmentCards.map((c) => [c.id, c.victoryPoints]));

  const trailblazerBadge = ruleset.bonusBadges.find((b) => b.id === "trailblazer");
  const vanguardBadge = ruleset.bonusBadges.find((b) => b.id === "vanguard");

  let trailblazerOwner: string | null = null;
  if (trailblazerBadge) {
    const lengths = state.players.map((p) => ({ id: p.id, len: longestRoadLength(topology, state, p.id) }));
    let best = trailblazerBadge.minimumToQualify - 1;
    let tieCount = 0;
    for (const { id, len } of lengths) {
      if (len > best) {
        best = len;
        trailblazerOwner = id;
        tieCount = 1;
      } else if (len === best && len >= trailblazerBadge.minimumToQualify) {
        tieCount++;
      }
    }
    if (tieCount > 1) trailblazerOwner = null;
  }

  let vanguardOwner: string | null = null;
  if (vanguardBadge) {
    let best = vanguardBadge.minimumToQualify - 1;
    let tieCount = 0;
    for (const p of state.players) {
      if (p.soldiersPlayed > best) {
        best = p.soldiersPlayed;
        vanguardOwner = p.id;
        tieCount = 1;
      } else if (p.soldiersPlayed === best && p.soldiersPlayed >= vanguardBadge.minimumToQualify) {
        tieCount++;
      }
    }
    if (tieCount > 1) vanguardOwner = null;
  }

  const players = state.players.map((p) => {
    let vp = 0;
    for (const building of Object.values(state.buildings)) {
      if (building.ownerId === p.id) vp += buildingVp.get(building.buildingTypeId) ?? 0;
    }
    for (const [cardId, count] of Object.entries(p.developmentCards)) {
      vp += (devVp.get(cardId) ?? 0) * count;
    }
    if (trailblazerBadge && trailblazerOwner === p.id) vp += trailblazerBadge.victoryPoints;
    if (vanguardBadge && vanguardOwner === p.id) vp += vanguardBadge.victoryPoints;
    return { ...p, victoryPoints: vp };
  });

  let newState: GameState = { ...state, players };
  const winner = players.find((p) => p.victoryPoints >= ruleset.winCondition.targetVictoryPoints);
  if (winner) newState = { ...newState, phase: "game-over" };
  return newState;
}
