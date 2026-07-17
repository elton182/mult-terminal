import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import type { TerminalInfo, TerminalState } from '@/types'

export const useTerminalsStore = defineStore('terminals', {
  state: () => ({
    /** Flat list of all open terminal processes. Grid placement is in workspacesStore. */
    terminals: [] as TerminalState[],
    /** Pending SerializeAddon dumps to restore on next xterm mount. */
    pendingScrollbacks: {} as Record<string, string>,
  }),

  getters: {
    list: (state) => state.terminals,
    byId: (state) => (id: string) => state.terminals.find((t) => t.id === id),
  },

  actions: {
    async openLocal(shellType: string): Promise<string> {
      const info = await invoke<TerminalInfo>('pty_spawn', {
        shellType,
        rows: 24,
        cols: 80,
      })
      const terminal: TerminalState = {
        id: info.id,
        title: info.title,
        shellType: info.shell_type,
        isConnected: true,
        type: 'local',
      }
      this.terminals = [...this.terminals, terminal]
      return info.id
    },

    async openSsh(opts: {
      id: string
      host: string
      port: number
      username: string
      password: string
      keyPath?: string
      name: string
      color?: string
      profileId: string
    }): Promise<string> {
      const id = await invoke<string>('ssh_connect', {
        id: opts.id,
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        keyPath: opts.keyPath ?? '',
        rows: 24,
        cols: 80,
      })
      const terminal: TerminalState = {
        id,
        title: `${opts.username}@${opts.host}`,
        shellType: 'ssh',
        color: opts.color,
        isConnected: true,
        type: 'ssh',
        profileId: opts.profileId,
      }
      this.terminals = [...this.terminals, terminal]
      return id
    },

    /** Hydrate terminal metadata without spawning (detach/reattach). */
    hydrate(terminals: TerminalState[]) {
      const byId = new Map(this.terminals.map((t) => [t.id, t]))
      for (const t of terminals) byId.set(t.id, t)
      this.terminals = [...byId.values()]
    },

    /** Remove metadata only — does not kill PTY/SSH. */
    detachMeta(ids: string[]) {
      const set = new Set(ids)
      this.terminals = this.terminals.filter((t) => !set.has(t.id))
    },

    setPendingScrollbacks(map: Record<string, string>) {
      this.pendingScrollbacks = { ...this.pendingScrollbacks, ...map }
    },

    takePendingScrollback(id: string): string | undefined {
      const s = this.pendingScrollbacks[id]
      if (s !== undefined) {
        const next = { ...this.pendingScrollbacks }
        delete next[id]
        this.pendingScrollbacks = next
      }
      return s
    },

    /** Destroys the PTY/SSH process. Workspace slot cleanup is handled by workspacesStore. */
    async close(id: string) {
      const terminal = this.terminals.find((t) => t.id === id)
      if (!terminal) return
      if (terminal.type === 'local') {
        await invoke('pty_kill', { id }).catch(() => {})
      } else {
        await invoke('ssh_disconnect', { id }).catch(() => {})
      }
      this.terminals = this.terminals.filter((t) => t.id !== id)
      const next = { ...this.pendingScrollbacks }
      delete next[id]
      this.pendingScrollbacks = next
    },

    rename(id: string, title: string) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.title = title
    },

    /** Set a user-facing label (overrides title in tabs/header). Empty string clears it. */
    setLabel(id: string, label: string) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.label = label.trim() || undefined
    },

    setColor(id: string, color: string | undefined) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.color = color
    },

    markDisconnected(id: string) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.isConnected = false
    },
  },
})
