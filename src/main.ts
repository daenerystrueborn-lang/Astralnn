// Astral Fantasy — entry point.
//
// Game logic lives in pure TS modules under src/engine + src/state (no DOM);
// src/ui/* are thin render layers over the GameStore. Port plan: BOT_LOGIC_PORT_NOTES.md.

import './ui/styles.css'
import { createContext } from './ui/app'

const { start } = createContext()
start()
