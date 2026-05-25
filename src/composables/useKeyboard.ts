/**
 * Prefix-based keyboard system (tmux-style).
 *
 * All shortcuts require two steps:
 *   1. Press the PREFIX chord  (default: Ctrl+B)
 *   2. Press the action key    (single key, no modifiers)
 *
 * The prefix is always captured — even when xterm has focus — so
 * there is no conflict with terminal programs.
 * After the prefix, the next key is also captured before xterm sees it.
 */

import { ref, onMounted, onUnmounted } from 'vue'

// ── Public state ──────────────────────────────────────────────────────────────

/** True while waiting for the second (action) key. */
export const prefixActive = ref(false)

/** Human-readable prefix chord shown in UI. */
export const PREFIX_LABEL = 'Ctrl+B'

// ── Internal ──────────────────────────────────────────────────────────────────

interface Action {
  key: string            // single key that fires after the prefix
  handler: () => void
}

const registry: Action[] = []
let listenerCount = 0
let cancelTimer: ReturnType<typeof setTimeout> | null = null

function isPrefix(e: KeyboardEvent): boolean {
  return e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b'
}

function deactivate() {
  prefixActive.value = false
  if (cancelTimer) { clearTimeout(cancelTimer); cancelTimer = null }
}

function onKeydown(e: KeyboardEvent) {
  // ── Step 1: prefix key ────────────────────────────────────
  if (!prefixActive.value) {
    if (isPrefix(e)) {
      e.preventDefault()
      e.stopPropagation()
      prefixActive.value = true
      cancelTimer = setTimeout(deactivate, 1500)
    }
    return
  }

  // ── Step 2: action key (always intercept) ─────────────────
  e.preventDefault()
  e.stopPropagation()
  const key = e.key
  deactivate()

  if (key === 'Escape') return  // just cancel prefix mode

  for (const action of registry) {
    if (key.toLowerCase() === action.key.toLowerCase()) {
      action.handler()
      return
    }
  }
}

// ── Composable (call once per component that owns shortcuts) ──────────────────

export function useKeyboard(actions: Action[]) {
  onMounted(() => {
    if (listenerCount === 0) {
      // capture: true so we intercept before xterm
      window.addEventListener('keydown', onKeydown, true)
    }
    listenerCount++
    registry.push(...actions)
  })

  onUnmounted(() => {
    actions.forEach((a) => {
      const i = registry.indexOf(a)
      if (i !== -1) registry.splice(i, 1)
    })
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('keydown', onKeydown, true)
      deactivate()
    }
  })
}

// ── Shortcut reference table (used in SettingsModal) ─────────────────────────

export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: `${PREFIX_LABEL} → t`,   description: 'Novo terminal' },
  { keys: `${PREFIX_LABEL} → w`,   description: 'Fechar terminal ativo' },
  { keys: `${PREFIX_LABEL} → n`,   description: 'Próximo terminal' },
  { keys: `${PREFIX_LABEL} → p`,   description: 'Terminal anterior' },
  { keys: `${PREFIX_LABEL} → a`,   description: 'Nova aba de workspace' },
  { keys: `${PREFIX_LABEL} → ]`,   description: 'Próxima aba' },
  { keys: `${PREFIX_LABEL} → [`,   description: 'Aba anterior' },
  { keys: `${PREFIX_LABEL} → 1`,   description: 'Layout: 1 coluna' },
  { keys: `${PREFIX_LABEL} → 2`,   description: 'Layout: 2 colunas' },
  { keys: `${PREFIX_LABEL} → 3`,   description: 'Layout: 1+2 linhas' },
  { keys: `${PREFIX_LABEL} → 4`,   description: 'Layout: 2+1 linhas' },
  { keys: `${PREFIX_LABEL} → 5`,   description: 'Layout: 2+3+1' },
  { keys: `${PREFIX_LABEL} → 6`,   description: 'Layout: 3+3 linhas' },
  { keys: `${PREFIX_LABEL} → ,`,   description: 'Configurações' },
  { keys: `${PREFIX_LABEL} → Esc`, description: 'Cancelar prefix' },
]
