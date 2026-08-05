import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Ruleset } from "../engine/ruleset/types";
import type { PlayerState } from "../engine/state/types";

interface DevelopmentCardsPanelProps {
  ruleset: Ruleset;
  player: PlayerState;
  onStartSoldierPlay: () => void;
  onStartPathBuilderPlay: () => void;
  onPlayMonopoly: (resourceId: string) => void;
  onPlayHarvest: (resourceIds: [string, string]) => void;
}

export function DevelopmentCardsPanel({
  ruleset,
  player,
  onStartSoldierPlay,
  onStartPathBuilderPlay,
  onPlayMonopoly,
  onPlayHarvest,
}: DevelopmentCardsPanelProps) {
  const [pickerCardId, setPickerCardId] = useState<"trade-monopoly" | "harvest" | null>(null);
  const [harvestPicks, setHarvestPicks] = useState<string[]>([]);

  const owned = ruleset.developmentCards.filter((c) => (player.developmentCards[c.id] ?? 0) > 0);
  if (owned.length === 0) return null;

  const closePicker = () => {
    setPickerCardId(null);
    setHarvestPicks([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Development Cards</Text>
      {owned.map((card) => {
        const count = player.developmentCards[card.id] ?? 0;
        return (
          <View key={card.id} style={styles.cardRow}>
            <Text style={styles.cardLabel}>
              {card.displayName} × {count}
            </Text>
            {card.id === "soldier" && (
              <Pressable style={styles.playBtn} onPress={onStartSoldierPlay}>
                <Text style={styles.playBtnText}>Play</Text>
              </Pressable>
            )}
            {card.id === "path-builder" && (
              <Pressable style={styles.playBtn} onPress={onStartPathBuilderPlay}>
                <Text style={styles.playBtnText}>Play</Text>
              </Pressable>
            )}
            {(card.id === "trade-monopoly" || card.id === "harvest") && (
              <Pressable style={styles.playBtn} onPress={() => setPickerCardId(card.id as "trade-monopoly" | "harvest")}>
                <Text style={styles.playBtnText}>Play</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {pickerCardId === "trade-monopoly" && (
        <View style={styles.pickerPanel}>
          <Text style={styles.pickerTitle}>Take all of which resource?</Text>
          <View style={styles.chipRow}>
            {ruleset.resources.map((r) => (
              <Pressable
                key={r.id}
                style={styles.chip}
                onPress={() => {
                  onPlayMonopoly(r.id);
                  closePicker();
                }}
              >
                <Text style={styles.chipText}>{r.displayName}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={closePicker}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {pickerCardId === "harvest" && (
        <View style={styles.pickerPanel}>
          <Text style={styles.pickerTitle}>Pick 2 resources ({harvestPicks.length}/2 selected)</Text>
          <View style={styles.chipRow}>
            {ruleset.resources.map((r) => (
              <Pressable
                key={r.id}
                style={styles.chip}
                onPress={() => {
                  if (harvestPicks.length >= 2) return;
                  const next = [...harvestPicks, r.id];
                  setHarvestPicks(next);
                  if (next.length === 2) {
                    onPlayHarvest([next[0], next[1]]);
                    closePicker();
                  }
                }}
              >
                <Text style={styles.chipText}>{r.displayName}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={closePicker}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#161616", borderRadius: 12, gap: 8 },
  title: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: "#ddd", fontSize: 13 },
  playBtn: { backgroundColor: "#2980b9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  playBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  pickerPanel: { marginTop: 4, gap: 8 },
  pickerTitle: { color: "#f1c40f", fontSize: 12, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#333", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chipText: { color: "#fff", fontSize: 12 },
  cancelText: { color: "#e74c3c", fontSize: 12 },
});
