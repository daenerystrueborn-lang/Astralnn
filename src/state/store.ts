// Game store — single-writer state container with versioned persistence.
//
// Discipline borrowed from the bot: every mutation runs through ONE entry
// point (update()), so there is never a second writer racing the save.
// Persistence is injected (StorageLike) so tests run without a browser;
// the default wires to localStorage when present, else an in-memory map.

import { SAVE_SCHEMA_VERSION, type Player } from './player'

export const SAVE_KEY = 'astral-fantasy-save'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** In-memory storage for tests / non-browser environments. */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

function defaultStorage(): StorageLike {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage
    if (ls && typeof ls.getItem === 'function') return ls
  } catch {
    // localStorage can throw in sandboxed iframes — fall through
  }
  return new MemoryStorage()
}

export interface SaveFile {
  schemaVersion: number
  savedAt: number
  player: Player
}

/**
 * migrateSave — versioned upgrade hook. Runs the chain from the file's
 * schemaVersion up to SAVE_SCHEMA_VERSION. V0 has exactly one version, so
 * the chain is empty; future versions append steps here.
 * Returns null when the file is unreadable or from a FUTURE version
 * (never clobber a newer save with an older loader).
 */
export function migrateSave(raw: unknown): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null
  const file = raw as Partial<SaveFile>
  if (typeof file.schemaVersion !== 'number' || !file.player) return null
  if (file.schemaVersion > SAVE_SCHEMA_VERSION) return null

  let player = file.player
  for (let v = file.schemaVersion; v < SAVE_SCHEMA_VERSION; v++) {
    // v1 → v2 migrations go here, in order.
    player = migratePlayer(player, v)
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: typeof file.savedAt === 'number' ? file.savedAt : Date.now(),
    player,
  }
}

function migratePlayer(player: Player, _fromVersion: number): Player {
  // v1 shape repair: the tutorial was briefly {step, completed:number[]} before
  // Slice 4 ported the bot's id-based engine, and pre-Slice-4 saves lack the
  // streak milestone fields. Normalise in place so ensureTutorial/claimDaily
  // always see the current shape.
  const t = player.tutorial as unknown as Record<string, unknown> | undefined
  if (!t || typeof t !== 'object' || Array.isArray(t.completed) === false || typeof t.completed !== 'object') {
    player.tutorial = {
      completed: [],
      graduated: false,
      graduationRewarded: false,
      graduatedAt: null,
      startedAt: Date.now(),
      skipped: false,
    }
  } else if ((t.completed as unknown[]).some((c) => typeof c !== 'string')) {
    // Old numeric-step saves: achievements cannot be recovered per-id; keep
    // graduationRewarded so a paid gift is never paid twice.
    const rewarded = t.graduationRewarded === true
    player.tutorial = {
      completed: [],
      graduated: false,
      graduationRewarded: rewarded,
      graduatedAt: null,
      startedAt: typeof t.startedAt === 'number' ? t.startedAt : Date.now(),
      skipped: false,
    }
  }
  if (!Array.isArray(player.streakMilestones)) player.streakMilestones = []
  if (typeof player.bestDailyStreak !== 'number') player.bestDailyStreak = 0
  // No-op for now; each future migration step transforms the record here.
  return player
}

export interface StoreOptions {
  storage?: StorageLike
  storageKey?: string
}

type Listener = (player: Player | null) => void

/**
 * GameStore — holds the current player, runs mutations through update(),
 * notifies subscribers, and autosaves after every committed mutation.
 */
export class GameStore {
  private storage: StorageLike
  private storageKey: string
  private player: Player | null = null
  private listeners = new Set<Listener>()

  constructor(options: StoreOptions = {}) {
    this.storage = options.storage ?? defaultStorage()
    this.storageKey = options.storageKey ?? SAVE_KEY
  }

  /** Load the save (with migration). Returns the player or null. */
  load(): Player | null {
    const raw = this.storage.getItem(this.storageKey)
    if (!raw) {
      this.player = null
      return null
    }
    try {
      const file = migrateSave(JSON.parse(raw))
      if (!file) {
        this.player = null
        return null
      }
      this.player = file.player
      return this.player
    } catch {
      this.player = null
      return null
    }
  }

  getState(): Player | null {
    return this.player
  }

  /** The player, or a thrown error when none exists yet. */
  requireState(): Player {
    if (!this.player) throw new Error('No player loaded')
    return this.player
  }

  /**
   * The single mutation entry point: run `mutator` against the player,
   * stamp updatedAt, autosave, notify. Returns the mutated player.
   */
  update(mutator: (player: Player) => void): Player {
    const player = this.requireState()
    mutator(player)
    player.updatedAt = Date.now()
    this.save()
    this.notify()
    return player
  }

  /** Install a freshly created player (registration). Persists immediately. */
  setPlayer(player: Player): void {
    this.player = player
    this.save()
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l(this.player)
  }

  save(): void {
    if (!this.player) return
    const file: SaveFile = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: Date.now(),
      player: this.player,
    }
    this.storage.setItem(this.storageKey, JSON.stringify(file))
  }

  /** Portable JSON for the Settings → Export flow. */
  exportSave(): string {
    const file: SaveFile = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: Date.now(),
      player: this.requireState(),
    }
    return JSON.stringify(file, null, 2)
  }

  /** Import a previously exported save. Throws on invalid/future files. */
  importSave(json: string): Player {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Save file is not valid JSON')
    }
    const file = migrateSave(parsed)
    if (!file) throw new Error('Save file is invalid or from a newer version')
    this.player = file.player
    this.save()
    this.notify()
    return this.player
  }

  /** Wipe the save entirely (Settings → Reset). */
  reset(): void {
    this.player = null
    this.storage.removeItem(this.storageKey)
    this.notify()
  }
}
