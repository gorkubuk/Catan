/**
 * Warm "wooden table" theme — a physical board game spread out under lamp
 * light, not a flat mobile-app dark mode. Kept centralized here so every
 * screen/component pulls from the same palette.
 */

export const tableGradient = ["#1a1108", "#2c1d10", "#231609"] as const;

export const panel = {
  background: "#2b1c11",
  border: "#7a5a34",
  headerText: "#f1e2c0",
  bodyText: "#cbb896",
  mutedText: "#a68f6a",
};

export const resourceColors: Record<string, string> = {
  timber: "#3b6b3f",
  clay: "#a8632c",
  wool: "#8fae5a",
  grain: "#d9ab3e",
  stone: "#8b8378",
};

export const wastelandColor = "#c9b077";

export const tileStroke = "#3c2712";
export const tileHighlight = "#ffffff22";

export const numberTokenFace = "#f1e2c0";
export const numberTokenRing = "#3c2712";
export const numberTokenHot = "#8c2f22";
export const numberTokenCold = "#3c2712";

export const blockerFill = "#241407";
export const blockerRing = "#f1e2c0";

export const unclaimedVertex = "#f3e6c8";
export const unclaimedVertexStroke = "#3c2712";
export const unclaimedEdge = "#8a6d3b55";

export const playerColors = ["#a8382c", "#3c6488", "#c99a2e", "#764a80"];

export function colorForPlayerIndex(index: number): string {
  return playerColors[index % playerColors.length];
}

export const accent = {
  gold: "#b8862c",
  goldText: "#2b1c11",
  danger: "#b5432f",
  success: "#4f7a3c",
  info: "#3c6488",
  disabledOpacity: 0.35,
};

export const headingFont = "Georgia, 'Times New Roman', serif";
