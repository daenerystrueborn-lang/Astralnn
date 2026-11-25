// Shared UI context + tiny in-memory router.
//
// Screens are render functions: render(root, ctx) rebuilds their DOM.
// The store is the single source of truth; navigation just re-renders.

import { GameStore } from '../state/store'
import type { Player } from '../state/player'
import type { TurnResult } from '../engine/battle'

export type ScreenId = 'register' | 'hub' | 'battle' | 'results' | 'death'

export interface UiContext {
  store: GameStore
  navigate(screen: ScreenId): void
  /** Last battle outcome, shown by the results/death screens. */
  lastResult: TurnResult | null
  setLastResult(r: TurnResult | null): void
  /** Combat log kept across re-renders of the battle screen. */
  battleLog: { kind: string; text: string }[]
  pushLog(events: { kind: string; text: string }[]): void
  clearLog(): void
}

export function createContext(): { ctx: UiContext; start(): void } {
  const store = new GameStore()

  let screen: ScreenId = 'hub'
  let root: HTMLElement | null = null
  let lastResult: TurnResult | null = null
  let battleLog: { kind: string; text: string }[] = []

  const ctx: UiContext = {
    store,
    navigate(next) {
      screen = next
      void render()
    },
    get lastResult() {
      return lastResult
    },
    setLastResult(r) {
      lastResult = r
    },
    get battleLog() {
      return battleLog
    },
    pushLog(events) {
      battleLog = [...battleLog, ...events]
      if (battleLog.length > 200) battleLog = battleLog.slice(-200)
    },
    clearLog() {
      battleLog = []
    },
  }

  async function render(): Promise<void> {
    if (!root) return
    const player = store.getState()

    // Route guards.
    if (!player && screen !== 'register') screen = 'register'
    if (player && screen === 'register') screen = 'hub'
    const bs = player?.battleState as { status?: string } | null | undefined
    if (player && bs && bs.status === 'active' && screen !== 'battle' && screen !== 'results' && screen !== 'death') {
      screen = 'battle'
    }

    const { renderRegister } = await import('./register')
    const { renderHub } = await import('./hub')
    const { renderBattle } = await import('./battle')
    const { renderResults, renderDeath } = await import('./results')

    root.innerHTML = ''
    switch (screen) {
      case 'register':
        renderRegister(root, ctx)
        break
      case 'hub':
        renderHub(root, ctx)
        break
      case 'battle':
        renderBattle(root, ctx)
        break
      case 'results':
        renderResults(root, ctx)
        break
      case 'death':
        renderDeath(root, ctx)
        break
    }
  }

  return {
    ctx,
    start() {
      root = document.querySelector<HTMLElement>('#app')
      store.load()
      void render()
    },
  }
}
