/** Axial coordinates for a hex grid (q + r + s = 0, s implied). */
export interface AxialCoord {
  q: number;
  r: number;
}

export interface Tile {
  coord: AxialCoord;
  tileTypeId: string;
  resourceId: string | null;
  /** Dice total that makes this tile produce, or null for non-producing tiles. */
  numberToken: number | null;
}

export interface Board {
  radius: number;
  tiles: Tile[];
}

export function axialKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}
