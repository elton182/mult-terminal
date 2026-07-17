import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useThemeStore, XTERM_THEMES } from '@/stores/theme'

export function useTerminal(
  terminalId: string,
  containerRef: Ref<HTMLElement | undefined>,
  terminalType: 'local' | 'ssh' = 'local',
  onExit?: () => void,
  initialScrollback?: Ref<string | undefined> | string,
) {
  let terminal: Terminal
  let fitAddon: FitAddon
  let serializeAddon: SerializeAddon
  let resizeObserver: ResizeObserver
  const unlisteners: UnlistenFn[] = []
  let resizeTimer: ReturnType<typeof setTimeout>
  let restoreTimers: ReturnType<typeof setTimeout>[] = []
  let disposed = false
  let removeCtx: (() => void) | undefined
  /** ViewportY salvo quando a janela perde o foco (Alt+Tab). */
  let savedViewportY = 0
  let savedAtBottom = true

  const writeCommand  = terminalType === 'local' ? 'pty_write'  : 'ssh_write'
  const resizeCommand = terminalType === 'local' ? 'pty_resize' : 'ssh_resize'

  const themeStore = useThemeStore()

  function isAtBottom(): boolean {
    if (disposed || !terminal) return true
    const buf = terminal.buffer.active
    return buf.viewportY >= buf.baseY
  }

  function restoreScroll(atBottom: boolean, line: number) {
    if (disposed || !terminal) return
    if (atBottom) terminal.scrollToBottom()
    else terminal.scrollToLine(line)
  }

  /** fit() preservando posição de scroll; ignora container oculto/zerado. */
  function fit(force = false) {
    if (disposed || !fitAddon || !terminal || !containerRef.value) return

    const { width, height } = containerRef.value.getBoundingClientRect()
    if (width < 2 || height < 2) return

    const proposed = fitAddon.proposeDimensions()
    if (
      !force &&
      proposed &&
      proposed.cols === terminal.cols &&
      proposed.rows === terminal.rows
    ) {
      return
    }

    const atBottom = isAtBottom()
    const line = terminal.buffer.active.viewportY

    fitAddon.fit()

    const { rows, cols } = terminal
    if (rows > 0 && cols > 0) {
      invoke(resizeCommand, { id: terminalId, rows, cols }).catch(console.error)
    }

    requestAnimationFrame(() => restoreScroll(atBottom, line))
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      onBlurOrHide()
    } else {
      onVisibilityOrFocus()
    }
  }

  function onVisibilityOrFocus() {
    if (document.visibilityState === 'hidden' || disposed) return
    const restore = () => restoreScroll(savedAtBottom, savedViewportY)
    restoreTimers.forEach(clearTimeout)
    requestAnimationFrame(() => {
      restore()
      fit()
      restoreTimers = [
        setTimeout(restore, 50),
        setTimeout(restore, 150),
      ]
    })
  }

  function onBlurOrHide() {
    if (disposed || !terminal) return
    savedAtBottom = isAtBottom()
    savedViewportY = terminal.buffer.active.viewportY
  }

  async function copySelection(): Promise<boolean> {
    if (!terminal) return false
    const text = terminal.getSelection()
    if (!text) return false
    try {
      await navigator.clipboard.writeText(text)
      terminal.clearSelection()
      return true
    } catch (e) {
      console.error('clipboard write failed', e)
      return false
    }
  }

  async function pasteClipboard(): Promise<void> {
    if (!terminal) return
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      await invoke(writeCommand, { id: terminalId, data: text })
    } catch (e) {
      console.error('clipboard read failed', e)
    }
  }

  function serialize(): string {
    if (disposed || !serializeAddon) return ''
    try {
      return serializeAddon.serialize()
    } catch {
      return ''
    }
  }

  function resolveInitialScrollback(): string | undefined {
    if (typeof initialScrollback === 'string') return initialScrollback
    if (initialScrollback && typeof initialScrollback === 'object') {
      return initialScrollback.value
    }
    return undefined
  }

  onMounted(async () => {
    if (!containerRef.value) return

    terminal = new Terminal({
      theme: XTERM_THEMES[themeStore.theme],
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowTransparency: true,
      rightClickSelectsWord: false,
    })

    fitAddon = new FitAddon()
    serializeAddon = new SerializeAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(serializeAddon)
    terminal.loadAddon(new WebLinksAddon())

    terminal.open(containerRef.value)
    fit(true)

    const scrollback = resolveInitialScrollback()
    if (scrollback) {
      await new Promise<void>((resolve) => {
        terminal.write(scrollback, () => resolve())
      })
      terminal.scrollToBottom()
    }

    // Clipboard: Ctrl+C copia se houver seleção; Ctrl+V cola
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey && !e.altKey && !e.metaKey

      if (ctrl && key === 'c') {
        if (e.shiftKey || terminal.hasSelection()) {
          e.preventDefault()
          void copySelection()
          return false
        }
        return true // SIGINT
      }

      if (ctrl && (key === 'v' || (e.shiftKey && key === 'v'))) {
        e.preventDefault()
        void pasteClipboard()
        return false
      }

      if (ctrl && e.shiftKey && key === 'c') {
        e.preventDefault()
        void copySelection()
        return false
      }

      return true
    })

    // Context menu Copy / Paste
    const onContextMenu = (ev: MouseEvent) => {
      ev.preventDefault()
      showContextMenu(ev.clientX, ev.clientY)
    }
    containerRef.value.addEventListener('contextmenu', onContextMenu)
    removeCtx = () => {
      containerRef.value?.removeEventListener('contextmenu', onContextMenu)
      hideContextMenu()
    }

    unlisteners.push(
      await listen<string>(`terminal-output:${terminalId}`, (e) =>
        terminal.write(e.payload),
      ),
    )

    unlisteners.push(
      await listen(`terminal-exit:${terminalId}`, () => {
        terminal.write('\r\n\x1b[2m[Sessão encerrada]\x1b[0m\r\n')
        onExit?.()
      }),
    )

    unlisteners.push(
      await listen<string>(`terminal-error:${terminalId}`, (e) => {
        terminal.write(`\r\n\x1b[31m[Erro: ${e.payload}]\x1b[0m\r\n`)
      }),
    )

    terminal.onData((data) => {
      invoke(writeCommand, { id: terminalId, data }).catch(console.error)
    })

    resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => fit(), 50)
    })
    resizeObserver.observe(containerRef.value)

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlurOrHide)
    window.addEventListener('focus', onVisibilityOrFocus)
  })

  // ── Context menu DOM ─────────────────────────────────────

  let menuEl: HTMLDivElement | null = null

  function hideContextMenu() {
    menuEl?.remove()
    menuEl = null
    document.removeEventListener('mousedown', onMenuOutside)
  }

  function onMenuOutside(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) hideContextMenu()
  }

  function showContextMenu(x: number, y: number) {
    hideContextMenu()
    menuEl = document.createElement('div')
    menuEl.className = 'xterm-ctx-menu'
    menuEl.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px; z-index: 9999;
      background: var(--bg-surface, #1e1e1e); border: 1px solid var(--border-default, #444);
      border-radius: 6px; padding: 4px; min-width: 120px;
      box-shadow: 0 4px 16px rgba(0,0,0,.4); font-size: 12px;
      color: var(--text-primary, #eee);
    `
    const mkBtn = (label: string, disabled: boolean, action: () => void) => {
      const b = document.createElement('button')
      b.textContent = label
      b.disabled = disabled
      b.style.cssText = `
        display: block; width: 100%; text-align: left; padding: 6px 10px;
        background: none; border: none; color: inherit; cursor: pointer;
        border-radius: 4px; font-size: 12px;
        opacity: ${disabled ? 0.4 : 1};
      `
      b.onmouseenter = () => { if (!disabled) b.style.background = 'var(--bg-overlay, #333)' }
      b.onmouseleave = () => { b.style.background = 'none' }
      b.onclick = () => { hideContextMenu(); action() }
      return b
    }
    menuEl.appendChild(mkBtn('Copiar', !terminal?.hasSelection(), () => { void copySelection() }))
    menuEl.appendChild(mkBtn('Colar', false, () => { void pasteClipboard() }))
    document.body.appendChild(menuEl)
    setTimeout(() => document.addEventListener('mousedown', onMenuOutside), 0)
  }

  watch(
    () => themeStore.theme,
    (t) => { if (terminal) terminal.options.theme = XTERM_THEMES[t] },
  )

  onUnmounted(() => {
    disposed = true
    clearTimeout(resizeTimer)
    restoreTimers.forEach(clearTimeout)
    removeCtx?.()
    hideContextMenu()
    unlisteners.forEach((fn) => { void fn() })
    resizeObserver?.disconnect()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('blur', onBlurOrHide)
    window.removeEventListener('focus', onVisibilityOrFocus)
    terminal?.dispose()
  })

  return { fit, serialize, copySelection, pasteClipboard }
}
