// Combat formulas — pure port of the V0 subset of lib/combat-engine.js.
// No I/O, no DOM; every function is data-in/numbers-out.
//
// The bot folds ~30 situational multipliers into calcPlayerDamage's single
// outgoing product. V0 ports the base funnel (primary stat × skill mult ×
// crit × situational) and keeps the product shape so V1 multipliers slot in
// without touching call sites.

import { lootingChance, sharpnessMultiplier, type EnchantCarrier } from './enchant'
import { attackStatKey } from './stats'
import { defaultRng, type Rng } from './rng'
import type { SkillDef } from '../data/types'

/** Player-shaped inputs the combat functions read. */
export interface Combatant extends EnchantCarrier {
  classId: string
  stats: { str: number; agi: number; int: number; def: number; lck: number }
}

export interface EnemyLike {
  tier?: 'regular' | 'elite' | 'boss'
  isBoss?: boolean
  evasion?: number
  type?: string
  weakTo?: string[]
  resistTo?: string[]
}

/** The combat-primary stat value for a player (STR, AGI or INT by class). */
export function getPrimaryStat(player: Combatant): number {
  return player.stats[attackStatKey(player)] ?? 0
}

/**
 * calcPlayerDamage — the single outgoing funnel.
 * V0 multipliers: primary stat × skill mult × critMult × damageMultiplier.
 * Skill power reads skill.multiplier ?? skill.effects[0].multiplier ?? 1.0 —
 * the corrected read (the bot's historical bug was reading only the top level).
 */
export function calcPlayerDamage(
  player: Combatant,
  skill: Partial<SkillDef> | null = null,
  damageMultiplier = 1,
  critChanceBoost = 0,
  rng: Rng = defaultRng,
): { rawDmg: number; isCrit: boolean; critMult: number } {
  const base = getPrimaryStat(player)
  // Legacy top-level multiplier is read too (the bot checks both shapes so
  // callers passing a pre-reshaped ability spec keep working).
  const legacyMult = (skill as { multiplier?: number } | null | undefined)?.multiplier
  const mult = legacyMult ?? skill?.effects?.[0]?.multiplier ?? 1.0

  // Crit: base 5% + LCK × 0.2%, capped at 95% (lib/combat-engine.js).
  const critChance = Math.min(0.95, 0.05 + (player.stats.lck ?? 0) * 0.002 + critChanceBoost)
  const isCrit = rng() < critChance
  const critMult = isCrit ? 1.5 : 1.0

  const sharpMult = sharpnessMultiplier(player)
  const rawDmg = Math.floor(base * mult * critMult * damageMultiplier * sharpMult)
  return { rawDmg, isCrit, critMult }
}

/**
 * applyDefense — percentage mitigation on the soft high-def curve:
 * mitigation = def / (def + 500), capped at 97%, floor of 1 damage.
 * (V0: no pierce/doctrine/armor-break — those arrive with abilities in V1.)
 */
export function applyDefense(rawDmg: number, monsterDef: number): number {
  const safeDef = Math.max(0, Number(monsterDef) || 0)
  const mitigation = safeDef / (safeDef + 500)
  const capped = Math.min(mitigation, 0.97)
  return Math.max(1, Math.floor(rawDmg * (1 - capped)))
}

/** Flat evasion per monster tier; explicit `evasion` overrides, clamped. */
export const MAX_EVASION = 0.75
const EVASION_BY_TIER: Record<string, number> = { regular: 0.05, elite: 0.10 }

export function monsterEvasion(enemy?: EnemyLike | null): number {
  const explicit = Number(enemy?.evasion)
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(MAX_EVASION, explicit)
  }
  if (enemy?.isBoss) return 0.02
  return EVASION_BY_TIER[String(enemy?.tier)] ?? 0.05
}

/**
 * Chance (0–1) the player's attack lands:
 * base 0.90 + AGI × 0.15% − enemy evasion, clamped [0.60, 0.99].
 */
export function calcPlayerHitChance(player: Combatant, enemy?: EnemyLike | null): number {
  const agi = player?.stats?.agi ?? 0
  const base = 0.90 + agi * 0.0015
  return Math.min(0.99, Math.max(0.60, base - monsterEvasion(enemy)))
}

/**
 * Chance (0–1) a monster's attack lands:
 * base 92% − player AGI dodge (cap 30%) + tier accuracy (boss +14%, elite +10%,
 * regular +5%), clamped [0.64, 0.99].
 */
export function calcMonsterHitChance(enemy: EnemyLike | null | undefined, player: Combatant): number {
  const agi = player?.stats?.agi ?? 0
  const dodge = Math.min(0.30, agi * 0.001)
  const tierAccuracy = enemy?.isBoss ? 0.14 : enemy?.tier === 'elite' ? 0.10 : 0.05
  return Math.min(0.99, Math.max(0.64, 0.92 - dodge + tierAccuracy))
}

/**
 * Monster damage against the player. Variance 0.80–1.20; defending doubles
 * DEF effectiveness; same soft mitigation curve, NaN-safe coercion, floor 1.
 */
export function calcMonsterDamage(
  monsterAtk: number,
  playerDef: number,
  defending = false,
  rng: Rng = defaultRng,
): number {
  // combat-engine.js:1110 — same +500 pivot and 0.80–1.20 variance as
  // applyDefense (mirrored direction). rng is injectable for tests; the bot
  // reads Math.random() directly — same behavior.
  const atk = Number.isFinite(Number(monsterAtk)) ? Number(monsterAtk) : 0
  const def = Math.max(0, Number.isFinite(Number(playerDef)) ? Number(playerDef) : 0)
  const variance = 0.80 + rng() * 0.40
  const effectiveDef = def * (defending ? 2.0 : 1.0)
  const mitigation = effectiveDef / (effectiveDef + 500)
  const capped = Math.min(mitigation, 0.97)
  return Math.max(1, Math.floor(atk * variance * (1 - capped)))
}

/**
 * Roll item drops from a monster's drops table. Zero-chance entries never
 * drop (placeholders cannot be farmed). V0: no Looting/Oath bonuses yet.
 */
export function rollDrops(
  drops: { itemId: string; chance: number }[] = [],
  rng: Rng = defaultRng,
  looter?: EnchantCarrier | null,
): string[] {
  const bonus = lootingChance(looter)
  return drops
    .filter(
      (d) =>
        (d.chance > 0 && rng() < Math.min(1, d.chance)) ||
        (bonus > 0 && d.chance > 0 && rng() < bonus),
    )
    .map((d) => d.itemId)
}

/** Check and reset daily stamina if past its reset time (midnight). */
export function refreshStamina(
  stamina: { current: number; max: number; resetAt: number } | null | undefined,
  now = Date.now(),
): { current: number; max: number; resetAt: number } {
  if (!stamina || now >= (stamina.resetAt ?? 0)) {
    const tom = new Date(now)
    tom.setHours(24, 0, 0, 0)
    return { current: stamina?.max ?? 30, max: stamina?.max ?? 30, resetAt: tom.getTime() }
  }
  return stamina
}

/**
 * Text HP bar, NaN-safe on both ends — exact port of combat-engine hpBar().
 * e.g. hpBar(5, 10) → "[█████░░░░░] 5/10"
 */
export function hpBar(current: unknown, max: unknown, length = 10): string {
  const ratio = Number(max) > 0 ? Number(current) / Number(max) : 0
  const safeRatio = Number.isFinite(ratio) ? ratio : 0
  const filled = Math.min(length, Math.max(0, Math.round(safeRatio * length)))
  const shownCurrent = Number.isFinite(Number(current)) ? Number(current) : 0
  const shownMax = Number.isFinite(Number(max)) ? Number(max) : 0
  return `[${'█'.repeat(filled)}${'░'.repeat(length - filled)}] ${shownCurrent}/${shownMax}`
}

/** Generic 0–1 progress bar (same style as hpBar, no labels). */
export function progressBar(pct: number, length = 10): string {
  const clamped = Math.max(0, Math.min(1, pct))
  const filled = Math.round(clamped * length)
  return `[${'█'.repeat(filled)}${'░'.repeat(length - filled)}]`
}
