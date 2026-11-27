// Astral Vault — pure browser port of plugins/vault.js + lib/astralpay.js.
//
// Safe storage for Solars (`player.wallet.vault`), feeding `ach_vault_keeper`
// (50,000 Solars stored).

export interface VaultPlayerSlice {
  wallet: { solars: number; vault?: number; [k: string]: number | undefined }
  battleState?: unknown
}

export interface VaultOutcome {
  ok: boolean
  error?: string
  amount?: number
  solarsAfter?: number
  vaultAfter?: number
}

export function getVaultBalance(player: Pick<VaultPlayerSlice, 'wallet'>): number {
  return Math.max(0, Math.floor(Number(player.wallet?.vault ?? 0) || 0))
}

export function depositToVault(player: VaultPlayerSlice, rawAmount: number): VaultOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot access the Astral Vault during battle.' }
  }
  const amount = Math.floor(Number(rawAmount))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a positive Solar amount to deposit.' }
  }
  const solars = Math.floor(player.wallet?.solars ?? 0)
  if (solars < amount) {
    return { ok: false, error: `Need ☀️ ${amount.toLocaleString()} Solars (have ☀️ ${solars.toLocaleString()}).` }
  }
  player.wallet.solars = solars - amount
  player.wallet.vault = getVaultBalance(player) + amount
  return {
    ok: true,
    amount,
    solarsAfter: player.wallet.solars,
    vaultAfter: player.wallet.vault,
  }
}

export function withdrawFromVault(player: VaultPlayerSlice, rawAmount: number): VaultOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot access the Astral Vault during battle.' }
  }
  const amount = Math.floor(Number(rawAmount))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a positive Solar amount to withdraw.' }
  }
  const vault = getVaultBalance(player)
  if (vault < amount) {
    return { ok: false, error: `Vault holds ☀️ ${vault.toLocaleString()} (tried to withdraw ☀️ ${amount.toLocaleString()}).` }
  }
  player.wallet.vault = vault - amount
  player.wallet.solars = (player.wallet.solars ?? 0) + amount
  return {
    ok: true,
    amount,
    solarsAfter: player.wallet.solars,
    vaultAfter: player.wallet.vault,
  }
}
