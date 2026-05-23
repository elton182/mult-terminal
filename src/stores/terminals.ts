import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import type { TerminalInfo, TerminalState } from '@/types'

export const useTerminalsStore = defineStore('terminals', {
  state: () => ({
    terminals: [] as TerminalState[],
  }),

  getters: {
    list: (state) => state.terminals,
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
      this.terminals.push(state)
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
      this.terminals.push(state)
      return id
    },

    async close(id: string) {
      const terminal = this.terminals.find((t) => t.id === id)
      if (!terminal) return

      if (terminal.type === 'local') {
        await invoke('pty_kill', { id }).catch(() => {})
      } else {
        await invoke('ssh_disconnect', { id }).catch(() => {})
      }

      this.terminals = this.terminals.filter((t) => t.id !== id)
    },

    rename(id: string, title: string) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.title = title
    },

    markDisconnected(id: string) {
      const t = this.terminals.find((t) => t.id === id)
      if (t) t.isConnected = false
    },
  },
})
