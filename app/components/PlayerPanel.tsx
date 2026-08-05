import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GamePhase, PlayerState } from "../engine/state/types";
import type { Ruleset } from "../engine/ruleset/types";
import { accent, colorForPlayerIndex, headingFont, panel } from "./theme";

interface PlayerPanelProps {
  ruleset: Ruleset;
  player: PlayerState;
  playerIndex: number;
  phase: GamePhase;
  turnNumber: number;
  lastDiceRoll: number[] | null;
}

const phaseLabels: Record<GamePhase, string> = {
  "setup-round-1": "Setup — round 1",
  "setup-round-2": "Setup — round 2",
  "awaiting-roll": "Awaiting dice roll",
  main: "Main phase",
  discard: "Discarding",
  "blocker-resolution": "Move the Raider",
  "game-over": "Game over",
};

export function PlayerPanel({ ruleset, player, playerIndex, phase, turnNumber, lastDiceRoll }: PlayerPanelProps) {
  const resourceLabel = (resourceId: string) => ruleset.resources.find((r) => r.id === resourceId)?.displayName ?? resourceId;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.swatch, { backgroundColor: colorForPlayerIndex(playerIndex) }]} />
        <Text style={styles.name}>{player.displayName}</Text>
        <Text style={styles.vp}>{player.victoryPoints} VP</Text>
      </View>
      <Text style={styles.meta}>
        Turn {turnNumber} · {phaseLabels[phase]}
        {lastDiceRoll ? ` · Rolled ${lastDiceRoll.join(" + ")} = ${lastDiceRoll.reduce((a, b) => a + b, 0)}` : ""}
      </Text>
      <View style={styles.resourceRow}>
        {ruleset.resources.map((r) => (
          <View key={r.id} style={styles.resourceChip}>
            <Text style={styles.resourceChipText}>
              {resourceLabel(r.id)}: {player.resources[r.id] ?? 0}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: panel.background, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: panel.border },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "#241407" },
  name: { color: panel.headerText, fontSize: 17, fontWeight: "700", fontFamily: headingFont, flex: 1 },
  vp: { color: accent.gold, fontSize: 14, fontWeight: "700" },
  meta: { color: panel.mutedText, fontSize: 12 },
  resourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  resourceChip: { backgroundColor: "#3a2716", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#5a4127" },
  resourceChipText: { color: panel.bodyText, fontSize: 12 },
});
