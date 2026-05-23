import { onMounted, onUnmounted, type Ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

const TERMINAL_THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f7840',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#76e3ea',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#87deea',
  brightWhite: '#f0f6fc',
}

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

  const writeCommand = terminalType === 'local' ? 'pty_write' : 'ssh_write'
  const resizeCommand = terminalType === 'local' ? 'pty_resize' : 'ssh_resize'

  onMounted(async () => {
    if (!containerRef.value) return

    terminal = new Terminal({
      theme: TERMINAL_THEME,
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
