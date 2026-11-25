// Astral Fantasy — clean-slate entry point.
//
// The previous browser combat/game was removed. This project is being rebuilt
// as the *game version* of the Astral WhatsApp bot (northernblader-sys/astralgaming).
// Port plan and logic reference: BOT_LOGIC_PORT_NOTES.md.
//
// Game logic should live in pure TS modules under src/ (no DOM/IO inside rules
// code) and be rendered by thin UI layers. Start there, not here.

const app = document.querySelector<HTMLElement>('#app')
if (app) {
  const note = app.querySelector<HTMLElement>('p.note')
  if (note) {
    note.textContent =
      'Clean slate — combat removed. See BOT_LOGIC_PORT_NOTES.md for the bot logic to replicate.'
  }
}
