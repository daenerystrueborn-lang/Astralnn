// Seeded RNG — same mulberry32 pattern the bot uses for deterministic
// character duels (lib/character-combat.js). Every engine that needs
// randomness takes an injected `rng: () => number` so tests can replay
// battles and spins exactly.

export type Rng = () => number

/** Deterministic generator. Returns a stream of [0, 1) floats. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Default rng for live play (matches the bot's Math.random usage). */
export const defaultRng: Rng = Math.random

/** Round Gems to 2 decimals — lib/format.js roundGems(). */
export function roundGems(amount: number): number {
  const n = Number(amount) || 0
  return Math.round(n * 100) / 100
}
