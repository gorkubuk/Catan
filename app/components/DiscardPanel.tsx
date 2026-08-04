import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Ruleset } from "../engine/ruleset/types";
import type { PlayerState, ResourceHand } from "../engine/state/types";

interface DiscardPanelProps {
  ruleset: Ruleset;
  player: PlayerState;
  requiredCount: number;
  onConfirm: (resources: ResourceHand) => void;
}

export function DiscardPanel({ ruleset, player, requiredCount, onConfirm }: DiscardPanelProps) {
  const [selection, setSelection] = useState<ResourceHand>({});
  const total = Object.values(selection).reduce((a, b) => a + b, 0);

  const adjust = (resourceId: string, delta: number) => {
    setSelection((prev) => {
      const current = prev[resourceId] ?? 0;
      const owned = player.resources[resourceId] ?? 0;
      const next = Math.max(0, Math.min(owned, current + delta));
      return { ...prev, [resourceId]: next };
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {player.displayName} must discard {requiredCount} card{requiredCount === 1 ? "" : "s"} ({total}/{requiredCount} selected)
      </Text>
      {ruleset.resources.map((r) => {
        const owned = player.resources[r.id] ?? 0;
        if (owned === 0) return null;
        const picked = selection[r.id] ?? 0;
        return (
          <View key={r.id} style={styles.row}>
            <Text style={styles.label}>
              {r.displayName} ({owned} owned)
            </Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => adjust(r.id, -1)}>
                <Text style={styles.stepBtnText}>-</Text>
              </Pressable>
              <Text style={styles.count}>{picked}</Text>
              <Pressable style={styles.stepBtn} onPress={() => adjust(r.id, 1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Pressable
        style={[styles.confirmBtn, total !== requiredCount && styles.confirmBtnDisabled]}
        disabled={total !== requiredCount}
        onPress={() => onConfirm(selection)}
      >
        <Text style={styles.confirmBtnText}>Discard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#1e1610", borderRadius: 12, gap: 8 },
  title: { color: "#fff", fontWeight: "700", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "#ddd", fontSize: 13 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  count: { color: "#fff", fontSize: 14, minWidth: 18, textAlign: "center" },
  confirmBtn: { marginTop: 4, backgroundColor: "#c0392b", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: "#fff", fontWeight: "700" },
});
