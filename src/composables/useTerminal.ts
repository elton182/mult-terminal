import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
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
) {
  let terminal: Terminal
  let fitAddon: FitAddon
  let resizeObserver: ResizeObserver
  const unlisteners: UnlistenFn[] = []
  let resizeTimer: ReturnType<typeof setTimeout>

  const writeCommand  = terminalType === 'local' ? 'pty_write'  : 'ssh_write'
  const resizeCommand = terminalType === 'local' ? 'pty_resize' : 'ssh_resize'

  const themeStore = useThemeStore()

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
    })

    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())

    terminal.open(containerRef.value)
    fitAddon.fit()

    // Receive output from backend
    unlisteners.push(
      await listen<string>(`terminal-output:${terminalId}`, (e) =>
        terminal.write(e.payload),
      ),
    )

    // Handle process exit
    unlisteners.push(
      await listen(`terminal-exit:${terminalId}`, () => {
        terminal.write('\r\n\x1b[2m[Sessão encerrada]\x1b[0m\r\n')
        onExit?.()
      }),
    )

    // Handle SSH errors
    unlisteners.push(
      await listen<string>(`terminal-error:${terminalId}`, (e) => {
        terminal.write(`\r\n\x1b[31m[Erro: ${e.payload}]\x1b[0m\r\n`)
      }),
    )

    // Send user input to backend
    terminal.onData((data) => {
      invoke(writeCommand, { id: terminalId, data }).catch(console.error)
    })

    // Sync PTY size when container resizes
    resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        fitAddon.fit()
        const { rows, cols } = terminal
        invoke(resizeCommand, { id: terminalId, rows, cols }).catch(console.error)
      }, 50)
    })
    resizeObserver.observe(containerRef.value)
  })

  // Atualiza tema do xterm quando o tema da UI muda
  watch(
    () => themeStore.theme,
    (t) => { if (terminal) terminal.options.theme = XTERM_THEMES[t] },
  )

  onUnmounted(() => {
    clearTimeout(resizeTimer)
    unlisteners.forEach((fn) => fn())
    resizeObserver?.disconnect()
    terminal?.dispose()
  })

  function fit() {
    if (!fitAddon) return
    fitAddon.fit()
    const { rows, cols } = terminal
    invoke(resizeCommand, { id: terminalId, rows, cols }).catch(console.error)
  }

  return { fit }
}
