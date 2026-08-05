import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Ruleset } from "../engine/ruleset/types";
import type { PlayerState } from "../engine/state/types";

interface BankTradePanelProps {
  ruleset: Ruleset;
  player: PlayerState;
  onTrade: (giveResourceId: string, receiveResourceId: string) => void;
}

export function BankTradePanel({ ruleset, player, onTrade }: BankTradePanelProps) {
  const [give, setGive] = useState<string | null>(null);
  const [receive, setReceive] = useState<string | null>(null);

  const canGive = (resourceId: string) => (player.resources[resourceId] ?? 0) >= ruleset.bankTradeRatio;
  const canConfirm = give && receive && give !== receive && canGive(give);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade with Bank ({ruleset.bankTradeRatio}:1)</Text>
      <Text style={styles.label}>Give:</Text>
      <View style={styles.chipRow}>
        {ruleset.resources.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.chip, give === r.id && styles.chipSelected, !canGive(r.id) && styles.chipDisabled]}
            onPress={() => setGive(r.id)}
          >
            <Text style={styles.chipText}>{r.displayName}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Receive:</Text>
      <View style={styles.chipRow}>
        {ruleset.resources.map((r) => (
          <Pressable
            key={r.id}
            style={[styles.chip, receive === r.id && styles.chipSelected]}
            onPress={() => setReceive(r.id)}
          >
            <Text style={styles.chipText}>{r.displayName}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
        disabled={!canConfirm}
        onPress={() => {
          if (!give || !receive) return;
          onTrade(give, receive);
          setGive(null);
          setReceive(null);
        }}
      >
        <Text style={styles.confirmBtnText}>Trade</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#161616", borderRadius: 12, gap: 6 },
  title: { color: "#fff", fontWeight: "700", fontSize: 14 },
  label: { color: "#aaa", fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#333", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chipSelected: { backgroundColor: "#2980b9" },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: "#fff", fontSize: 12 },
  confirmBtn: { marginTop: 4, backgroundColor: "#27ae60", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: "#fff", fontWeight: "700" },
});
