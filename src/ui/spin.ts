// Recruitment (spin) — banner list, x1/x5 pulls, reveal.
// runSpinBatch owns dead-zone/plateau/pity and wallet debit (Slice 1 parity).

import { SPIN_BANNERS, runSpinBatch, bannerCharacter, spinsUsed, type SpinBanner } from '../engine/gacha'
import { iconOr } from './icon'
import type { UiContext } from './app'

export function renderSpin(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.requireState()
  let selected: SpinBanner | null = null

  function draw(): void {
    const p = ctx.store.requireState()
    root.innerHTML = `
      <h1>RECRUITMENT</h1>
      <p class="subtitle">${iconOr('icons/coin_crown', '☀️')} ${Math.floor(p.wallet.solars)} · ${iconOr('icons/gem_blue', '💎')} ${p.wallet.gems}</p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        <button class="tab" data-nav="roster" type="button">Roster</button>
      </div>

      <div id="banner-list">
        ${Object.values(SPIN_BANNERS)
          .map((b) => {
            const char = bannerCharacter(b.id)
            const owned = p.ownedCharacters.includes(b.id)
            const used = spinsUsed(p, b)
            const pity = b.pityAt < 9999 ? `${used}/${b.pityAt} pity` : `${used}/${b.maxSpinsPerPlayer}`
            return `
            <div class="loc ${owned ? 'locked' : ''}" data-banner="${b.id}" ${owned ? '' : 'data-open="1"'}>
              <div>
                <div class="loc-name">${char?.emoji ?? '🎴'} ${char?.name ?? b.id}</div>
                <div class="loc-sub">${b.costPerSpin} ${b.currency}/spin · ${pity}${owned ? ' · owned' : ''}</div>
              </div>
              <div>${owned ? '✅' : '🎰'}</div>
            </div>`
          })
          .join('')}
      </div>

      <div id="spin-panel" hidden></div>
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelector('#banner-list')!.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.loc')
      if (!el || !el.dataset.open) return
      selected = SPIN_BANNERS[el.dataset.banner!]!
      drawPanel()
    })
    if (selected) drawPanel()
  }

  function drawPanel(): void {
    if (!selected) return
    const banner = selected
    const p = ctx.store.requireState()
    const char = bannerCharacter(banner.id)
    const panel = root.querySelector<HTMLElement>('#spin-panel')!
    const used = spinsUsed(p, banner)
    const oneCost = banner.costPerSpin
    const fiveCost = Math.round(oneCost * Math.min(5, banner.maxSpinsPerCommand) * 100) / 100
    const balance = p.wallet[banner.currency === 'gems' ? 'gems' : 'solars'] ?? 0

    panel.hidden = false
    panel.innerHTML = `
      <div class="panel center">
        <h3>${char?.emoji ?? '🎴'} ${char?.name ?? banner.id}</h3>
        <p class="muted">
          ${banner.currency === 'gems' ? '💎' : '☀️'} ${oneCost} per spin ·
          dead zone until ${banner.deadZoneUntil} · plateau ${(banner.plateauChance * 100).toFixed(0)}% ·
          ${banner.pityAt < 9999 ? `pity at ${banner.pityAt}` : 'no pity'}<br/>
          Spins ${used}/${banner.maxSpinsPerPlayer} · balance ${balance}
        </p>
        <div class="grid-2 mt">
          <button class="btn btn-primary" data-pull="1" ${balance < oneCost || p.ownedCharacters.includes(banner.id) ? 'disabled' : ''} type="button">
            SPIN ×1
          </button>
          <button class="btn" data-pull="${Math.min(5, banner.maxSpinsPerCommand)}" ${balance < fiveCost || p.ownedCharacters.includes(banner.id) ? 'disabled' : ''} type="button">
            SPIN ×${Math.min(5, banner.maxSpinsPerCommand)}
          </button>
        </div>
        <div id="spin-reveal" class="mt"></div>
        <button class="btn btn-ghost btn-sm mt" id="spin-back" type="button">← all banners</button>
      </div>
    `

    panel.querySelector('#spin-back')!.addEventListener('click', () => {
      selected = null
      draw()
    })
    panel.querySelectorAll<HTMLButtonElement>('[data-pull]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.pull)
        let outcome: ReturnType<typeof runSpinBatch> | null = null
        ctx.store.update((pp) => {
          outcome = runSpinBatch(pp as never, banner, n)
        })
        draw()
        showReveal(outcome)
      })
    })
  }

  function showReveal(outcome: ReturnType<typeof runSpinBatch> | null): void {
    if (!outcome) return
    const box = root.querySelector<HTMLElement>('#spin-reveal')
    if (!box) return
    if (outcome.reason === 'owned') {
      box.innerHTML = `<p class="muted">You already own this character.</p>`
      return
    }
    if (outcome.reason === 'gems' || outcome.reason === 'solars') {
      box.innerHTML = `<p class="error">Not enough ${outcome.currency ?? ''} for another spin.</p>`
      return
    }
    if (outcome.reason === 'exhausted_lifetime') {
      box.innerHTML = `<p class="muted">Lifetime spins exhausted for this banner.</p>`
      return
    }
    const rows = (outcome.results ?? [])
      .map((r) => `<div class="reward-line"><span>Spin #${r.spin}</span><b>${r.won ? '✨ WON!' : 'miss'}</b></div>`)
      .join('')
    const won = outcome.reason === 'won'
    box.innerHTML = `
      <div class="${won ? 'levelup-box' : 'panel'}">
        ${won ? `🎉 ${bannerCharacter(selected?.id ?? '')?.name ?? ''} joins your roster!` : 'Better luck next spin…'}
        ${rows}
      </div>`
  }

  draw()
}
