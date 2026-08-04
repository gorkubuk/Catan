import React, { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { HexBoard } from "../components/HexBoard";
import { PlayerPanel } from "../components/PlayerPanel";
import { DiscardPanel } from "../components/DiscardPanel";
import { useGameEngine } from "../store/useGameEngine";
import { createGame } from "../engine/state/createGame";
import { randomSeed } from "../engine/rng";
import { islandTradeRuleset } from "../engine/rulesets/islandTrade";
import { axialKey } from "../engine/board/types";
import type { AxialCoord } from "../engine/board/types";
import type { ResourceHand } from "../engine/state/types";

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
}

export function GameScreen() {
  const [initialState, setInitialState] = useState(newGameState);
  const { state, topology, lastError, perform, resetGame } = useGameEngine(islandTradeRuleset, initialState);
  const [stealPrompt, setStealPrompt] = useState<StealPrompt | null>(null);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isSetup = state.phase === "setup-round-1" || state.phase === "setup-round-2";

  const handleNewGame = () => {
    const next = newGameState();
    setInitialState(next);
    resetGame(next);
    setStealPrompt(null);
  };

  const handleVertexPress = (vertexId: string) => {
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
    perform(currentPlayer.id, { type: "PLACE_ROAD", edgeId });
  };

  const handleTilePress = (coord: AxialCoord) => {
    if (state.phase !== "blocker-resolution") return;
    const key = axialKey(coord);
    if (key === state.blockerTileKey) return;

    const touchingVertexIds = [...topology.vertices.values()]
      .filter((v) => v.tileCoords.some((c) => axialKey(c) === key))
      .map((v) => v.id);

    const owners = new Set<string>();
    for (const vId of touchingVertexIds) {
      const building = state.buildings[vId];
      if (building && building.ownerId !== currentPlayer.id) owners.add(building.ownerId);
    }
    const eligiblePlayerIds = [...owners].filter((pid) => {
      const p = state.players.find((pl) => pl.id === pid)!;
      return Object.values(p.resources).reduce((a, b) => a + b, 0) > 0;
    });

    if (eligiblePlayerIds.length === 0) {
      perform(currentPlayer.id, { type: "MOVE_BLOCKER", tileCoord: coord });
    } else {
      setStealPrompt({ tileCoord: coord, eligiblePlayerIds });
    }
  };

  const resolveSteal = (targetPlayerId: string | null) => {
    if (!stealPrompt) return;
    perform(currentPlayer.id, {
      type: "MOVE_BLOCKER",
      tileCoord: stealPrompt.tileCoord,
      stealFromPlayerId: targetPlayerId ?? undefined,
    });
    setStealPrompt(null);
  };

  const handleDiscardConfirm = (playerId: string) => (resources: ResourceHand) => {
    perform(playerId, { type: "DISCARD_RESOURCES", resources });
  };

  const setupHint =
    isSetup && state.setupStep === "settlement"
      ? `${currentPlayer.displayName}: place a settlement`
      : isSetup && state.setupStep === "road"
        ? `${currentPlayer.displayName}: place the connecting road`
        : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Island Trade</Text>
          <Pressable style={styles.newGameBtn} onPress={handleNewGame}>
            <Text style={styles.newGameBtnText}>New Game</Text>
          </Pressable>
        </View>

        {setupHint && <Text style={styles.hint}>{setupHint}</Text>}
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
                <Pressable key={pid} style={styles.stealBtn} onPress={() => resolveSteal(pid)}>
                  <Text style={styles.stealBtnText}>{state.players.find((p) => p.id === pid)!.displayName}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.stealBtn, styles.skipBtn]} onPress={() => resolveSteal(null)}>
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

        <View style={styles.actionRow}>
          {state.phase === "awaiting-roll" && (
            <Pressable style={styles.actionBtn} onPress={() => perform(currentPlayer.id, { type: "ROLL_DICE" })}>
              <Text style={styles.actionBtnText}>Roll Dice</Text>
            </Pressable>
          )}
          {state.phase === "main" && (
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
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0d0d0d" },
  scrollContent: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  newGameBtn: { backgroundColor: "#2c3e50", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  newGameBtnText: { color: "#fff", fontWeight: "600" },
  hint: { color: "#f1c40f", fontSize: 13, fontWeight: "600" },
  error: { color: "#e74c3c", fontSize: 13 },
  winner: { color: "#2ecc71", fontSize: 18, fontWeight: "800", textAlign: "center" },
  stealPanel: { backgroundColor: "#161616", borderRadius: 12, padding: 12, gap: 8 },
  stealRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stealBtn: { backgroundColor: "#8e44ad", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  skipBtn: { backgroundColor: "#555" },
  stealBtnText: { color: "#fff", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { backgroundColor: "#27ae60", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontWeight: "700" },
});
