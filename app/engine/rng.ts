/**
 * All game randomness must flow through a SeededRng so that:
 *  - the server can generate a seed, keep it secret until reveal, and later
 *    prove a roll/shuffle was fair by publishing the seed
 *  - a full match can be replayed deterministically from (seed + move log)
 * Never call Math.random() anywhere else in the engine.
 */
export interface SeededRng {
  readonly seed: string;
  next(): number;
}

function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed: string): SeededRng {
  const seedHash = xmur3(seed);
  const next = mulberry32(seedHash());
  return { seed, next };
}

export function randomSeed(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
}

/** Integer in [min, max], inclusive on both ends. */
export function randomInt(rng: SeededRng, min: number, max: number): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

export function rollDie(rng: SeededRng, sides = 6): number {
  return randomInt(rng, 1, sides);
}

export function rollDice(rng: SeededRng, count: number, sides = 6): number[] {
  return Array.from({ length: count }, () => rollDie(rng, sides));
}

/** Fisher-Yates using the seeded rng; does not mutate the input array. */
export function shuffle<T>(rng: SeededRng, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
