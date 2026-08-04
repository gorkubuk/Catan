export const resourceColors: Record<string, string> = {
  timber: "#2f6b3a",
  clay: "#b5651d",
  wool: "#8bc34a",
  grain: "#e8c547",
  stone: "#8a8f96",
};

export const wastelandColor = "#d9c9a3";

export const playerColors = ["#e74c3c", "#3498db", "#f1c40f", "#9b59b6"];

export function colorForPlayerIndex(index: number): string {
  return playerColors[index % playerColors.length];
}
