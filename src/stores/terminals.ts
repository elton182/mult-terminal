import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import type { TerminalInfo, TerminalState } from '@/types'

export const useTerminalsStore = defineStore('terminals', {
  state: () => ({
    /**
     * Sparse array: position in the array = flat grid-slot index.
     * A null entry means the slot exists in the layout but has no terminal.
     */
    terminals: [] as (TerminalState | null)[],
  }),

  getters: {
    /** Sparse grid array — use this for grid-position calculations. */
    list: (state) => state.terminals,

    /** Dense list of non-null terminals — use this for tabs and cycling. */
    activeTerminals: (state) =>
      state.terminals.filter((t): t is TerminalState => t !== null),
  },

  actions: {
    async openLocal(shellType: string) {
      const info = await invoke<TerminalInfo>('pty_spawn', {
        shellType,
        rows: 24,
        cols: 80,
      })
      const state: TerminalState = {
        id: info.id,
        title: info.title,
        shellType: info.shell_type,
        isConnected: true,
        type: 'local',
      }
      this._place(state)
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
    }) {
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
      const state: TerminalState = {
        id,
        title: `${opts.username}@${opts.host}`,
        shellType: 'ssh',
        color: opts.color,
        isConnected: true,
        type: 'ssh',
        profileId: opts.profileId,
      }
      this._place(state)
      return id
    },

    /** Fill first null slot, or append if none exists. */
    _place(state: TerminalState) {
      const emptyIdx = this.terminals.indexOf(null)
      if (emptyIdx !== -1) {
        const next = [...this.terminals]
        next[emptyIdx] = state
        this.terminals = next
      } else {
        this.terminals = [...this.terminals, state]
      }
    },

    async close(id: string) {
      const idx = this.terminals.findIndex((t) => t?.id === id)
      if (idx === -1) return

      const terminal = this.terminals[idx]!

      if (terminal.type === 'local') {
        await invoke('pty_kill', { id }).catch(() => {})
      } else {
        await invoke('ssh_disconnect', { id }).catch(() => {})
      }

      const next = [...this.terminals]
      next[idx] = null
      // Remove trailing nulls so the array stays compact
      while (next.length > 0 && next[next.length - 1] === null) next.pop()
      this.terminals = next
    },

    rename(id: string, title: string) {
      const t = this.terminals.find((t) => t?.id === id)
      if (t) t.title = title
    },

    markDisconnected(id: string) {
      const t = this.terminals.find((t) => t?.id === id)
      if (t) t.isConnected = false
    },

    /** Swap two terminals by id. Works even if one slot is null (treated as empty). */
    swap(id1: string, id2: string) {
      const i = this.terminals.findIndex((t) => t?.id === id1)
      const j = this.terminals.findIndex((t) => t?.id === id2)
      if (i === -1 || j === -1 || i === j) return
      const next = [...this.terminals]
      ;[next[i], next[j]] = [next[j], next[i]]
      this.terminals = next
    },

    /** Move terminal to a specific flat-index slot (which may be empty/null/beyond array). */
    moveTo(id: string, targetIdx: number) {
      const i = this.terminals.findIndex((t) => t?.id === id)
      if (i === -1 || i === targetIdx) return
      const next = [...this.terminals] as (TerminalState | null)[]
      // Extend to reach the target index
      while (next.length <= targetIdx) next.push(null)
      const terminal = next[i]
      next[i] = null
      next[targetIdx] = terminal
      // Remove trailing nulls
      while (next.length > 0 && next[next.length - 1] === null) next.pop()
      this.terminals = next
    },
  },
})
