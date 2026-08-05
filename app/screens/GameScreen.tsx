import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HexBoard } from "../components/HexBoard";
import { PlayerPanel } from "../components/PlayerPanel";
import { DiscardPanel } from "../components/DiscardPanel";
import { BankTradePanel } from "../components/BankTradePanel";
import { DevelopmentCardsPanel } from "../components/DevelopmentCardsPanel";
import { accent, headingFont, panel, playerColors, tableGradient } from "../components/theme";
import { useGameEngine } from "../store/useGameEngine";
import { createGame } from "../engine/state/createGame";
import { randomSeed } from "../engine/rng";
import { islandTradeRuleset } from "../engine/rulesets/islandTrade";
import { axialKey } from "../engine/board/types";
import type { AxialCoord } from "../engine/board/types";
import type { BoardTopology } from "../engine/board/topology";
import type { GameState, ResourceHand } from "../engine/state/types";

const PLAYER_ROSTER = [
  { id: "p1", displayName: "Player 1" },
  { id: "p2", displayName: "Player 2" },
  { id: "p3", displayName: "Player 3" },
];

function newGameState() {
  return createGame(islandTradeRuleset, randomSeed(), PLAYER_ROSTER);
}

interface StealPrompt {
  tileCoord: AxialCoord;
  eligiblePlayerIds: string[];
  /** What to do once a target (or "skip") is chosen. */
  resolve: (targetPlayerId: string | null) => void;
}

type InteractionMode = { kind: "idle" } | { kind: "playing-soldier" } | { kind: "playing-path-builder"; firstEdgeId: string | null };

function eligibleStealTargets(state: GameState, topology: BoardTopology, coord: AxialCoord, actingPlayerId: string): string[] {
  const key = axialKey(coord);
  const touchingVertexIds = [...topology.vertices.values()]
    .filter((v) => v.tileCoords.some((c) => axialKey(c) === key))
    .map((v) => v.id);

  const owners = new Set<string>();
  for (const vId of touchingVertexIds) {
    const building = state.buildings[vId];
    if (building && building.ownerId !== actingPlayerId) owners.add(building.ownerId);
  }
  return [...owners].filter((pid) => {
    const p = state.players.find((pl) => pl.id === pid)!;
    return Object.values(p.resources).reduce((a, b) => a + b, 0) > 0;
  });
}

export function GameScreen() {
  const [initialState, setInitialState] = useState(newGameState);
  const { state, topology, lastError, perform, resetGame } = useGameEngine(islandTradeRuleset, initialState);
  const [stealPrompt, setStealPrompt] = useState<StealPrompt | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: "idle" });

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";

  const handleNewGame = () => {
    const next = newGameState();
    setInitialState(next);
    resetGame(next);
    setStealPrompt(null);
    setMode({ kind: "idle" });
  };

  const handleVertexPress = (vertexId: string) => {
    if (mode.kind !== "idle") return;
    const existing = state.buildings[vertexId];
    if (existing) {
      if (state.phase === "main" && existing.ownerId === currentPlayer.id && existing.buildingTypeId === "settlement") {
        perform(currentPlayer.id, { type: "BUILD_CITY", vertexId });
      }
      return;
    }
    const isSettlementStep = isSetup ? state.setupStep === "settlement" : state.phase === "main";
    if (isSettlementStep) {
      perform(currentPlayer.id, { type: "PLACE_SETTLEMENT", vertexId });
    }
  };

  const handleEdgePress = (edgeId: string) => {
    if (mode.kind === "playing-path-builder") {
      if (!mode.firstEdgeId) {
        setMode({ kind: "playing-path-builder", firstEdgeId: edgeId });
        return;
      }
      if (mode.firstEdgeId === edgeId) return;
      const ok = perform(currentPlayer.id, {
        type: "PLAY_DEVELOPMENT_CARD",
        cardId: "path-builder",
        edgeIds: [mode.firstEdgeId, edgeId],
      });
      if (ok) setMode({ kind: "idle" });
      return;
    }
    if (mode.kind !== "idle") return;
    perform(currentPlayer.id, { type: "PLACE_ROAD", edgeId });
  };

  const handleTilePress = (coord: AxialCoord) => {
    const key = axialKey(coord);
    if (key === state.blockerTileKey) return;

    if (state.phase === "blocker-resolution") {
      const eligiblePlayerIds = eligibleStealTargets(state, topology, coord, currentPlayer.id);
      if (eligiblePlayerIds.length === 0) {
        perform(currentPlayer.id, { type: "MOVE_BLOCKER", tileCoord: coord });
      } else {
        setStealPrompt({
          tileCoord: coord,
          eligiblePlayerIds,
          resolve: (targetPlayerId) =>
            perform(currentPlayer.id, { type: "MOVE_BLOCKER", tileCoord: coord, stealFromPlayerId: targetPlayerId ?? undefined }),
        });
      }
      return;
    }

    if (mode.kind === "playing-soldier") {
      const eligiblePlayerIds = eligibleStealTargets(state, topology, coord, currentPlayer.id);
      const finish = (targetPlayerId: string | null) => {
        const ok = perform(currentPlayer.id, {
          type: "PLAY_DEVELOPMENT_CARD",
          cardId: "soldier",
          tileCoord: coord,
          stealFromPlayerId: targetPlayerId ?? undefined,
        });
        if (ok) setMode({ kind: "idle" });
      };
      if (eligiblePlayerIds.length === 0) {
        finish(null);
      } else {
        setStealPrompt({ tileCoord: coord, eligiblePlayerIds, resolve: finish });
      }
    }
  };

  const handleDiscardConfirm = (playerId: string) => (resources: ResourceHand) => {
    perform(playerId, { type: "DISCARD_RESOURCES", resources });
  };

  const setupHint =
    isSetup && state.setupStep === "settlement"
      ? `${currentPlayer.displayName}: place a settlement`
      : isSetup && state.setupStep === "road"
        ? `${currentPlayer.displayName}: place the connecting road`
        : mode.kind === "playing-soldier"
          ? "Tap a tile to move the Raider"
          : mode.kind === "playing-path-builder"
            ? mode.firstEdgeId
              ? "Tap a second edge for your free road"
              : "Tap an edge for your first free road"
            : null;

  return (
    <LinearGradient colors={tableGradient} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Island Trade</Text>
          <Pressable style={styles.newGameBtn} onPress={handleNewGame}>
            <Text style={styles.newGameBtnText}>New Game</Text>
          </Pressable>
        </View>

        {setupHint && <Text style={styles.hint}>{setupHint}</Text>}
        {mode.kind !== "idle" && (
          <Pressable onPress={() => setMode({ kind: "idle" })}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
        {lastError && <Text style={styles.error}>{lastError}</Text>}
        {state.phase === "game-over" && (
          <Text style={styles.winner}>
            {state.players.find((p) => p.victoryPoints >= islandTradeRuleset.winCondition.targetVictoryPoints)?.displayName} wins!
          </Text>
        )}

        <HexBoard
          board={state.board}
          topology={topology}
          buildings={state.buildings}
          roads={state.roads}
          blockerTileKey={state.blockerTileKey}
          players={state.players}
          onTilePress={handleTilePress}
          onVertexPress={handleVertexPress}
          onEdgePress={handleEdgePress}
        />

        {stealPrompt && (
          <View style={styles.stealPanel}>
            <Text style={styles.hint}>Steal a resource from:</Text>
            <View style={styles.stealRow}>
              {stealPrompt.eligiblePlayerIds.map((pid) => (
                <Pressable
                  key={pid}
                  style={styles.stealBtn}
                  onPress={() => {
                    stealPrompt.resolve(pid);
                    setStealPrompt(null);
                  }}
                >
                  <Text style={styles.stealBtnText}>{state.players.find((p) => p.id === pid)!.displayName}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.stealBtn, styles.skipBtn]}
                onPress={() => {
                  stealPrompt.resolve(null);
                  setStealPrompt(null);
                }}
              >
                <Text style={styles.stealBtnText}>Skip</Text>
              </Pressable>
            </View>
          </View>
        )}

        {state.phase === "discard" &&
          state.playersAwaitingDiscard.map((playerId) => {
            const player = state.players.find((p) => p.id === playerId)!;
            const required = Math.floor(Object.values(player.resources).reduce((a, b) => a + b, 0) / 2);
            return (
              <DiscardPanel
                key={playerId}
                ruleset={islandTradeRuleset}
                player={player}
                requiredCount={required}
                onConfirm={handleDiscardConfirm(playerId)}
              />
            );
          })}

        <PlayerPanel
          ruleset={islandTradeRuleset}
          player={currentPlayer}
          playerIndex={state.currentPlayerIndex}
          phase={state.phase}
          turnNumber={state.turnNumber}
          lastDiceRoll={state.lastDiceRoll}
        />

        {state.phase === "main" && mode.kind === "idle" && (
          <>
            <BankTradePanel
              ruleset={islandTradeRuleset}
              player={currentPlayer}
              onTrade={(give, receive) =>
                perform(currentPlayer.id, {
                  type: "TRADE_WITH_BANK",
                  giveResourceId: give,
                  giveAmount: islandTradeRuleset.bankTradeRatio,
                  receiveResourceId: receive,
                })
              }
            />
            <DevelopmentCardsPanel
              ruleset={islandTradeRuleset}
              player={currentPlayer}
              onStartSoldierPlay={() => setMode({ kind: "playing-soldier" })}
              onStartPathBuilderPlay={() => setMode({ kind: "playing-path-builder", firstEdgeId: null })}
              onPlayMonopoly={(resourceId) =>
                perform(currentPlayer.id, { type: "PLAY_DEVELOPMENT_CARD", cardId: "trade-monopoly", resourceId })
              }
              onPlayHarvest={(resourceIds) =>
                perform(currentPlayer.id, { type: "PLAY_DEVELOPMENT_CARD", cardId: "harvest", resourceIds })
              }
            />
          </>
        )}

        <View style={styles.actionRow}>
          {state.phase === "awaiting-roll" && (
            <Pressable style={styles.actionBtn} onPress={() => perform(currentPlayer.id, { type: "ROLL_DICE" })}>
              <Text style={styles.actionBtnText}>Roll Dice</Text>
            </Pressable>
          )}
          {state.phase === "main" && mode.kind === "idle" && (
            <>
              <Pressable
                style={styles.actionBtn}
                onPress={() => perform(currentPlayer.id, { type: "BUY_DEVELOPMENT_CARD" })}
              >
                <Text style={styles.actionBtnText}>Buy Dev Card</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => perform(currentPlayer.id, { type: "END_TURN" })}>
                <Text style={styles.actionBtnText}>End Turn</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: panel.headerText, fontSize: 24, fontWeight: "800", fontFamily: headingFont, letterSpacing: 0.5 },
  newGameBtn: {
    backgroundColor: panel.background,
    borderWidth: 1,
    borderColor: panel.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newGameBtnText: { color: panel.headerText, fontWeight: "600" },
  hint: { color: accent.gold, fontSize: 13, fontWeight: "600" },
  cancelText: { color: accent.danger, fontSize: 13, fontWeight: "600" },
  error: { color: accent.danger, fontSize: 13 },
  winner: { color: "#c9d97a", fontSize: 20, fontWeight: "800", fontFamily: headingFont, textAlign: "center" },
  stealPanel: { backgroundColor: panel.background, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: panel.border },
  stealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stealBtn: { backgroundColor: playerColors[3], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  skipBtn: { backgroundColor: "#4a3a28" },
  stealBtnText: { color: panel.headerText, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { backgroundColor: accent.gold, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: accent.goldText, fontWeight: "700" },
});
