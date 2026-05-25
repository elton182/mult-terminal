import { defineStore } from 'pinia'
import { Store } from '@tauri-apps/plugin-store'

export type Theme = 'dark' | 'high-contrast' | 'dark-red' | 'dark-green' | 'overclock'

let _store: Store | null = null
async function store() {
  if (!_store) _store = await Store.load('settings.json')
  return _store
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'dark' as Theme,
  }),

  actions: {
    async load() {
      try {
        const s = await store()
        this.theme = (await s.get<Theme>('theme')) ?? 'dark'
      } catch {
        this.theme = 'dark'
      }
      this._apply()
    },

    async set(t: Theme) {
      this.theme = t
      this._apply()
      try {
        const s = await store()
        await s.set('theme', t)
        await s.save()
      } catch { /* ignore */ }
    },

    _apply() {
      document.documentElement.setAttribute('data-theme', this.theme)
    },
  },
})

/* ── Temas xterm.js por tema da UI ───────────────────────── */
export const XTERM_THEMES: Record<Theme, object> = {
  dark: {
    background:         '#0d1117',
    foreground:         '#c9d1d9',
    cursor:             '#58a6ff',
    cursorAccent:       '#0d1117',
    selectionBackground:'#264f7840',
    black:   '#484f58', red:     '#ff7b72',
    green:   '#3fb950', yellow:  '#d29922',
    blue:    '#58a6ff', magenta: '#bc8cff',
    cyan:    '#76e3ea', white:   '#b1bac4',
    brightBlack:   '#6e7681', brightRed:     '#ffa198',
    brightGreen:   '#56d364', brightYellow:  '#e3b341',
    brightBlue:    '#79c0ff', brightMagenta: '#d2a8ff',
    brightCyan:    '#87deea', brightWhite:   '#f0f6fc',
  },
  'high-contrast': {
    background:         '#000000',
    foreground:         '#ffffff',
    cursor:             '#4fc3f7',
    cursorAccent:       '#000000',
    selectionBackground:'#4fc3f733',
    black:   '#1a1a1a', red:     '#ff6e6e',
    green:   '#69ff47', yellow:  '#ffd600',
    blue:    '#4fc3f7', magenta: '#e040fb',
    cyan:    '#00e5ff', white:   '#e8e8e8',
    brightBlack:   '#888888', brightRed:     '#ff9d9d',
    brightGreen:   '#9dff7a', brightYellow:  '#ffe566',
    brightBlue:    '#80d8ff', brightMagenta: '#ea80fc',
    brightCyan:    '#80ffff', brightWhite:   '#ffffff',
  },
  'dark-red': {
    background:         '#130c0c',
    foreground:         '#e8d5d5',
    cursor:             '#ff6b6b',
    cursorAccent:       '#130c0c',
    selectionBackground:'#ff6b6b30',
    black:   '#3b2020', red:     '#ff4040',
    green:   '#3fb950', yellow:  '#d29922',
    blue:    '#ff6b6b', magenta: '#bc8cff',
    cyan:    '#76e3ea', white:   '#c8b4b4',
    brightBlack:   '#7a6060', brightRed:     '#ff8080',
    brightGreen:   '#56d364', brightYellow:  '#e3b341',
    brightBlue:    '#ff9090', brightMagenta: '#d2a8ff',
    brightCyan:    '#87deea', brightWhite:   '#f0e0e0',
  },
  'overclock': {
    background:         '#0e0703',
    foreground:         '#d8c8a0',   /* âmbar claro */
    cursor:             '#39d353',   /* verde neon */
    cursorAccent:       '#0e0703',
    selectionBackground:'#39d35328',
    black:   '#2c1a08', red:     '#ff6b6b',
    green:   '#39d353', yellow:  '#f97316',   /* laranja */
    blue:    '#56d364', magenta: '#d2a8ff',
    cyan:    '#76e3ea', white:   '#d8c8a0',
    brightBlack:   '#6a5c3a', brightRed:     '#ff9090',
    brightGreen:   '#4ade80', brightYellow:  '#fb923c',
    brightBlue:    '#6ee7a0', brightMagenta: '#e9c46a',
    brightCyan:    '#87deea', brightWhite:   '#f0e4c0',
  },
  'dark-green': {
    background:         '#050f07',
    foreground:         '#c8e8cc',
    cursor:             '#39d353',
    cursorAccent:       '#050f07',
    selectionBackground:'#39d35330',
    black:   '#1a3020', red:     '#ff7b72',
    green:   '#39d353', yellow:  '#d29922',
    blue:    '#58a6ff', magenta: '#bc8cff',
    cyan:    '#76e3ea', white:   '#b1c8b4',
    brightBlack:   '#547060', brightRed:     '#ffa198',
    brightGreen:   '#56d364', brightYellow:  '#e3b341',
    brightBlue:    '#79c0ff', brightMagenta: '#d2a8ff',
    brightCyan:    '#87deea', brightWhite:   '#d0f0d4',
  },
}
