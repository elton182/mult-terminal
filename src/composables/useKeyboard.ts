import { onMounted, onUnmounted } from 'vue'

export interface KeyboardAction {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: (e: KeyboardEvent) => void
}

export function useKeyboard(actions: KeyboardAction[]) {
  function onKeydown(e: KeyboardEvent) {
    for (const action of actions) {
      if (
        e.key.toLowerCase() === action.key.toLowerCase() &&
        !!e.ctrlKey === !!action.ctrl &&
        !!e.shiftKey === !!action.shift &&
        !!e.altKey === !!action.alt
      ) {
        // Don't fire if focus is inside an xterm canvas (terminal handles input itself)
        const tag = (e.target as HTMLElement)?.tagName
        const inTerminal = (e.target as HTMLElement)?.closest?.('.xterm-helper-textarea') !== null
        if (inTerminal) continue

        e.preventDefault()
        action.handler(e)
        break
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, true))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
}

export const SHORTCUTS = [
  { keys: 'Ctrl+T', description: 'Novo terminal' },
  { keys: 'Ctrl+Shift+T', description: 'Novo terminal (shell padrão)' },
  { keys: 'Ctrl+W', description: 'Fechar terminal ativo' },
  { keys: 'Ctrl+Tab', description: 'Próximo terminal' },
  { keys: 'Ctrl+Shift+Tab', description: 'Terminal anterior' },
  { keys: 'Ctrl+Alt+1', description: 'Layout: 1 coluna' },
  { keys: 'Ctrl+Alt+2', description: 'Layout: 2 colunas' },
  { keys: 'Ctrl+Alt+3', description: 'Layout: 1+2 linhas' },
  { keys: 'Ctrl+Alt+4', description: 'Layout: 2+1 linhas' },
  { keys: 'Ctrl+Alt+5', description: 'Layout: 2+3+1 linhas' },
  { keys: 'Ctrl+Alt+6', description: 'Layout: 3+3 linhas' },
  { keys: 'Ctrl+,', description: 'Configurações' },
]
