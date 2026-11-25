// Settings — save export / import / reset (audio toggles are placeholders).

import type { UiContext } from './app'

export function renderSettings(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.getState()

  root.innerHTML = `
    <h1>SETTINGS</h1>
    <p class="subtitle">Save data · schema v1</p>

    <div class="tabs">
      <button class="tab" data-nav="hub" type="button">← Hub</button>
      <button class="tab" data-nav="profile" type="button">Profile</button>
    </div>

    <div class="panel">
      <h3>Export save</h3>
      <p class="muted">Copy your save file as JSON (backup or move devices).</p>
      <button class="btn" id="export" type="button">COPY SAVE JSON</button>
      <textarea class="input mt" id="export-box" readonly rows="5" hidden></textarea>
    </div>

    <div class="panel">
      <h3>Import save</h3>
      <p class="muted">Paste a previously exported save. Replaces current progress.</p>
      <textarea class="input" id="import-box" rows="5" placeholder='{"schemaVersion":1,...}'></textarea>
      <button class="btn mt" id="import" type="button">IMPORT</button>
      <p class="error" id="import-error"></p>
    </div>

    <div class="panel">
      <h3>Reset</h3>
      <p class="muted">Deletes this save permanently. ${player ? `Currently: ${player.name} (Lv ${player.level}).` : 'No save loaded.'}</p>
      <button class="btn btn-danger" id="reset" type="button">DELETE SAVE</button>
    </div>

    <div class="panel">
      <h3>Audio</h3>
      <p class="muted">Sound toggles arrive with the art pass (placeholder).</p>
      <div class="row"><span>Music</span><button class="btn btn-sm" disabled type="button">off</button></div>
      <div class="row mt"><span>SFX</span><button class="btn btn-sm" disabled type="button">off</button></div>
    </div>
  `

  root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
  })

  root.querySelector('#export')!.addEventListener('click', () => {
    const json = ctx.store.exportSave()
    const box = root.querySelector<HTMLTextAreaElement>('#export-box')!
    box.hidden = false
    box.value = json
    box.select()
    void navigator.clipboard?.writeText(json).catch(() => undefined)
  })

  root.querySelector('#import')!.addEventListener('click', () => {
    const box = root.querySelector<HTMLTextAreaElement>('#import-box')!
    const errEl = root.querySelector<HTMLElement>('#import-error')!
    errEl.textContent = ''
    try {
      ctx.store.importSave(box.value)
      ctx.navigate('hub')
    } catch (err) {
      errEl.textContent = err instanceof Error ? err.message : String(err)
    }
  })

  root.querySelector('#reset')!.addEventListener('click', () => {
    if (!confirm('Delete this save permanently? This cannot be undone.')) return
    ctx.store.reset()
    ctx.navigate('register')
  })
}
