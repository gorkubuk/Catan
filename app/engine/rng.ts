/**
 * All game randomness must flow through this module so that:
 *  - the server can generate a seed, keep it secret until reveal, and later
 *    prove a roll/shuffle was fair by publishing the seed
 *  - a full match can be replayed deterministically from (seed + move log)
 *  - GameState.rngState (a plain number) can be serialized to Postgres and
 *    resumed on any client/server without losing the sequence
 * Never call Math.random() anywhere else in the engine.
 */
export interface RngCursor {
  state: number;
  next(): number;
}

export function seedFromString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRngCursor(seedOrState: string | number): RngCursor {
  const initialState = typeof seedOrState === "string" ? seedFromString(seedOrState) : seedOrState;
  const cursor: RngCursor = {
    state: initialState,
    next(): number {
      let a = cursor.state | 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      cursor.state = a;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return cursor;
}

export function randomSeed(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
}

/** Integer in [min, max], inclusive on both ends. */
export function randomInt(cursor: RngCursor, min: number, max: number): number {
  return Math.floor(cursor.next() * (max - min + 1)) + min;
}

export function rollDie(cursor: RngCursor, sides = 6): number {
  return randomInt(cursor, 1, sides);
}

export function rollDice(cursor: RngCursor, count: number, sides = 6): number[] {
  return Array.from({ length: count }, () => rollDie(cursor, sides));
}

/** Fisher-Yates using the cursor; does not mutate the input array. */
export function shuffle<T>(cursor: RngCursor, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(cursor, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
