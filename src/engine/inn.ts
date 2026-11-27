// Astral Town Inn — exact port of plugins/inn.js.
//
// Out-of-combat rest & recovery in Astral Town:
//   SOLAR_PER_HP = 0.5  (costHp = Math.ceil(missingHp * 0.5))
//   SOLAR_PER_MP = 0.3  (costMp = Math.ceil(missingMp * 0.3))
//   costFull     = costHp + costMp
// Refuses while a battle is active.

export const SOLAR_PER_HP = 0.5
export const SOLAR_PER_MP = 0.3

export type InnRestMode = 'full' | 'hp' | 'mp'

export interface InnPlayerSlice {
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  wallet: { solars: number; [k: string]: number }
  battleState?: unknown
}

export interface InnQuote {
  missingHp: number
  missingMp: number
  costHp: number
  costMp: number
  costFull: number
  needsRest: boolean
}

export interface InnRestOutcome {
  ok: boolean
  error?: string
  mode?: InnRestMode
  cost?: number
  healedHp?: number
  restoredMp?: number
}

/** Price quote for Full, HP-only, and MP-only recovery at the Astral Inn. */
export function innRestQuote(player: Pick<InnPlayerSlice, 'hp' | 'maxHp' | 'mp' | 'maxMp'>): InnQuote {
  const missingHp = Math.max(0, Math.floor((player.maxHp ?? 0) - (player.hp ?? 0)))
  const missingMp = Math.max(0, Math.floor((player.maxMp ?? 0) - (player.mp ?? 0)))
  const costHp = missingHp > 0 ? Math.ceil(missingHp * SOLAR_PER_HP) : 0
  const costMp = missingMp > 0 ? Math.ceil(missingMp * SOLAR_PER_MP) : 0
  return {
    missingHp,
    missingMp,
    costHp,
    costMp,
    costFull: costHp + costMp,
    needsRest: missingHp > 0 || missingMp > 0,
  }
}

/**
 * Rest at the Astral Inn (exact plugins/inn.js rules):
 *  - Refused if currently in an active battle.
 *  - Refused if the requested pool(s) are already full.
 *  - Deducts Solars and restores HP and/or MP to max.
 */
export function restAtInn(player: InnPlayerSlice, mode: InnRestMode = 'full'): InnRestOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot rest at the Inn during an active battle.' }
  }

  const quote = innRestQuote(player)
  if (mode === 'hp' && quote.missingHp <= 0) {
    return { ok: false, error: 'Your HP is already full.' }
  }
  if (mode === 'mp' && quote.missingMp <= 0) {
    return { ok: false, error: 'Your MP is already full.' }
  }
  if (mode === 'full' && !quote.needsRest) {
    return { ok: false, error: 'Your HP and MP are already full.' }
  }

  const cost = mode === 'hp' ? quote.costHp : mode === 'mp' ? quote.costMp : quote.costFull
  const solars = player.wallet?.solars ?? 0
  if (solars < cost) {
    return { ok: false, error: `Need ☀️ ${cost} Solars to rest (have ☀️ ${Math.floor(solars)}).` }
  }

  player.wallet.solars = solars - cost
  let healedHp = 0
  let restoredMp = 0
  if (mode === 'full' || mode === 'hp') {
    healedHp = quote.missingHp
    player.hp = player.maxHp
  }
  if (mode === 'full' || mode === 'mp') {
    restoredMp = quote.missingMp
    player.mp = player.maxMp
  }

  return { ok: true, mode, cost, healedHp, restoredMp }
}
