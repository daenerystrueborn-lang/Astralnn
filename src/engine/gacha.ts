// Gacha / spin banners — port of lib/spin-banners.js (banner table + pull
// loop) and chanceForExclusiveSpin() from lib/season-engine.js.
//
// V0 single-player differences from the bot (documented, deliberate):
//  - no bot-wide exclusive lock: winning simply adds the character to
//    `ownedCharacters`; `exclusive` banners keep their curve and cap
//  - no Premium extra spins, no preorders, no god-series acquisition block
//  - RNG is injected so tests can replay a batch exactly
// NEVER show deadZone/plateau to players — only pity progress (bot rule).

import { characterMap } from '../data'
import { defaultRng, roundGems, type Rng } from './rng'

export interface SpinBanner {
  id: string
  /** Per-player lifetime spin counter on the player record. */
  spinField: string
  costPerSpin: number
  currency: 'gems' | 'solars'
  /** Spins 1..deadZoneUntil can never win. */
  deadZoneUntil: number
  /** Flat win chance per spin after the dead zone. */
  plateauChance: number
  /** Spin ≥ pityAt always wins (9999 = no guaranteed win). */
  pityAt: number
  maxSpinsPerPlayer: number
  maxSpinsPerCommand: number
  exclusive: boolean
}

/**
 * Banner definitions keyed by character id — ported from lib/spin-banners.js.
 * (GOD_BANNERS from the bot's god-series catalog are deferred to a later
 * content pass.)
 */
export const SPIN_BANNERS: Record<string, SpinBanner> = {
  the_end: {
    id: 'the_end', spinField: 'endSpins', costPerSpin: 1.5, currency: 'gems',
    deadZoneUntil: 247, plateauChance: 0.80, pityAt: 250,
    maxSpinsPerPlayer: 250, maxSpinsPerCommand: 5, exclusive: true,
  },
  gogeta: {
    id: 'gogeta', spinField: 'gogetaSpins', costPerSpin: 1.5, currency: 'gems',
    deadZoneUntil: 230, plateauChance: 0.80, pityAt: 9999,
    maxSpinsPerPlayer: 250, maxSpinsPerCommand: 20, exclusive: true,
  },
  cid: {
    id: 'cid', spinField: 'cidSpins', costPerSpin: 0.5, currency: 'gems',
    deadZoneUntil: 324, plateauChance: 0.80, pityAt: 9999,
    maxSpinsPerPlayer: 350, maxSpinsPerCommand: 20, exclusive: true,
  },
  queen_of_fairies: {
    id: 'queen_of_fairies', spinField: 'queenOfFairiesSpins', costPerSpin: 1, currency: 'gems',
    deadZoneUntil: 284, plateauChance: 0.90, pityAt: 9999,
    maxSpinsPerPlayer: 310, maxSpinsPerCommand: 20, exclusive: true,
  },
  clane: {
    id: 'clane', spinField: 'claneSpins', costPerSpin: 1.5, currency: 'gems',
    deadZoneUntil: 257, plateauChance: 0.50, pityAt: 9999,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 20, exclusive: true,
  },
  victoria_minayoko: {
    id: 'victoria_minayoko', spinField: 'victoriaSpins', costPerSpin: 1.4, currency: 'gems',
    deadZoneUntil: 276, plateauChance: 1, pityAt: 277,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 20, exclusive: true,
  },
  kim_dokja: {
    id: 'kim_dokja', spinField: 'kimDokjaSpins', costPerSpin: 5, currency: 'gems',
    deadZoneUntil: 369, plateauChance: 0.08, pityAt: 400,
    maxSpinsPerPlayer: 400, maxSpinsPerCommand: 10, exclusive: true,
  },
  rimuru: {
    id: 'rimuru', spinField: 'rimuruSpins', costPerSpin: 3, currency: 'gems',
    deadZoneUntil: 374, plateauChance: 0.08, pityAt: 400,
    maxSpinsPerPlayer: 400, maxSpinsPerCommand: 10, exclusive: true,
  },
  minato: {
    id: 'minato', spinField: 'minatoSpins', costPerSpin: 3, currency: 'gems',
    deadZoneUntil: 321, plateauChance: 0.08, pityAt: 350,
    maxSpinsPerPlayer: 350, maxSpinsPerCommand: 10, exclusive: true,
  },
  surtr: {
    id: 'surtr', spinField: 'surtrSpins', costPerSpin: 3, currency: 'gems',
    deadZoneUntil: 276, plateauChance: 0.80, pityAt: 9999,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 5, exclusive: true,
  },
  rengoku: {
    id: 'rengoku', spinField: 'rengokuSpins', costPerSpin: 50000, currency: 'solars',
    deadZoneUntil: 378, plateauChance: 0.08, pityAt: 400,
    maxSpinsPerPlayer: 400, maxSpinsPerCommand: 10, exclusive: true,
  },
  remi: {
    id: 'remi', spinField: 'remiSpins', costPerSpin: 2, currency: 'gems',
    deadZoneUntil: 234, plateauChance: 0.12, pityAt: 300,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 10, exclusive: true,
  },
  cardia: {
    id: 'cardia', spinField: 'cardiaSpins', costPerSpin: 100000, currency: 'solars',
    deadZoneUntil: 286, plateauChance: 0.15, pityAt: 300,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 10, exclusive: true,
  },
  aimiya: {
    id: 'aimiya', spinField: 'aimiyaSpins', costPerSpin: 3, currency: 'gems',
    deadZoneUntil: 286, plateauChance: 0.15, pityAt: 300,
    maxSpinsPerPlayer: 300, maxSpinsPerCommand: 10, exclusive: true,
  },
}

/** The banner for a character id, or null. */
export function getSpinBanner(id: string | null | undefined): SpinBanner | null {
  if (!id) return null
  return SPIN_BANNERS[String(id).toLowerCase()] ?? null
}

/** The currency a banner charges: 'solars' or (default) 'gems'. */
export function spinCurrency(banner: SpinBanner): 'solars' | 'gems' {
  return banner?.currency === 'solars' ? 'solars' : 'gems'
}

export function spinWalletKey(banner: SpinBanner): 'solars' | 'gems' {
  return spinCurrency(banner)
}

/** The odds for one spin — exact port of season-engine chanceForExclusiveSpin(). */
export function chanceForExclusiveSpin(
  spinNumber: number,
  overrides: { pityAt?: number; deadZoneUntil?: number; plateauChance?: number } = {},
): number {
  const spin = Math.max(1, Number(spinNumber) || 1)
  const pityAt = Math.max(1, Number(overrides.pityAt ?? 150))
  const deadZoneUntil = Math.max(0, Number(overrides.deadZoneUntil ?? 79))
  const plateauChance = Math.min(1, Math.max(0, Number(overrides.plateauChance ?? 0.8)))
  if (spin >= pityAt) return 1
  if (spin <= deadZoneUntil) return 0
  return plateauChance
}

/** A wallet balance in the banner's currency, normalised the way it is kept. */
export function spinBalance(player: { wallet?: Record<string, number> }, banner: SpinBanner): number {
  const raw = player?.wallet?.[spinWalletKey(banner)] ?? 0
  return spinCurrency(banner) === 'solars'
    ? Math.max(0, Math.floor(Number(raw) || 0))
    : roundGems(raw)
}

/** Spins this player has already burned on a banner. */
export function spinsUsed(player: Record<string, unknown>, banner: SpinBanner): number {
  return Number(player?.[banner.spinField] ?? 0)
}

/** Spins left before the lifetime cap (V0: no Premium bonus). */
export function spinsLeft(player: Record<string, unknown>, banner: SpinBanner): number {
  return Math.max(0, banner.maxSpinsPerPlayer - spinsUsed(player, banner))
}

/** Clamps a requested batch size to the per-command and lifetime caps. */
export function clampSpinCount(banner: SpinBanner, requested: number): number {
  const n = Math.floor(Number(requested) || 1)
  return Math.min(banner.maxSpinsPerCommand, banner.maxSpinsPerPlayer, Math.max(1, n))
}

/** The player slice the pull loop reads/writes. */
export interface SpinnerPlayer {
  wallet: Record<string, number>
  ownedCharacters: string[]
  [spinField: string]: unknown
}

export interface SpinResult {
  reason:
    | 'owned'
    | 'gems'
    | 'solars'
    | 'exhausted_lifetime'
    | 'won'
    | 'exhausted'
  results?: { spin: number; won: boolean }[]
  spinsUsed?: number
  remaining?: number
  count?: number
  currency?: 'gems' | 'solars'
  gems?: number
  solars?: number
  cost?: number
}

/**
 * runSpinBatch — the pull loop (single-player port).
 * Stops the instant the player owns the character or funds run out.
 * Every outcome that spent also carries `currency` and `remaining`.
 */
export function runSpinBatch(
  player: SpinnerPlayer,
  banner: SpinBanner,
  requested: number,
  rng: Rng = defaultRng,
): SpinResult {
  const count = clampSpinCount(banner, requested)
  player.ownedCharacters = player.ownedCharacters ?? []
  player.wallet = player.wallet ?? {}

  if (player.ownedCharacters.includes(banner.id)) return { reason: 'owned' }

  const currency = spinCurrency(banner)
  const walletKey = spinWalletKey(banner)
  let funds = spinBalance(player, banner)
  const results: { spin: number; won: boolean }[] = []
  let won = false
  let used = 0

  for (let i = 0; i < count; i++) {
    if (funds < banner.costPerSpin) break
    if (spinsUsed(player, banner) >= banner.maxSpinsPerPlayer) break

    const nextSpin = spinsUsed(player, banner) + 1
    const chance = chanceForExclusiveSpin(nextSpin, {
      deadZoneUntil: banner.deadZoneUntil,
      plateauChance: banner.plateauChance,
      pityAt: banner.pityAt,
    })
    const rolledWin = nextSpin >= banner.pityAt || rng() < chance

    funds = currency === 'solars' ? funds - banner.costPerSpin : roundGems(funds - banner.costPerSpin)
    player.wallet[walletKey] = funds
    player[banner.spinField] = nextSpin
    used++

    if (!rolledWin) {
      results.push({ spin: nextSpin, won: false })
      continue
    }

    results.push({ spin: nextSpin, won: true })
    if (!player.ownedCharacters.includes(banner.id)) player.ownedCharacters.push(banner.id)
    won = true
    break
  }

  if (!results.length) {
    return {
      reason: spinsUsed(player, banner) >= banner.maxSpinsPerPlayer
        ? 'exhausted_lifetime'
        : currency,
      [currency]: funds,
      cost: banner.costPerSpin,
      currency,
    } as SpinResult
  }

  return {
    reason: won ? 'won' : 'exhausted',
    results,
    spinsUsed: used,
    remaining: player.wallet[walletKey],
    count,
    currency,
  }
}

/** Character lookup for a banner id (roster display). */
export function bannerCharacter(id: string) {
  return characterMap[id] ?? null
}
