import { defineStore } from 'pinia'
import type { WorkspaceTab } from '@/types'

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    tabs: [
      {
        id: 'ws-1',
        label: 'Aba 1',
        columns: [1],
        slots: [] as (string | null)[],
        activeTerminalId: undefined as string | undefined,
      },
    ] as WorkspaceTab[],
    activeTabId: 'ws-1',
  }),

  getters: {
    list: (state) => state.tabs,
    activeTab: (state) =>
      state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0],
  },

  actions: {
    // ── Tab management ──────────────────────────────────────

    addTab(label?: string): string {
      const id = crypto.randomUUID()
      const num = this.tabs.length + 1
      this.tabs.push({
        id,
        label: label ?? `Aba ${num}`,
        columns: [1],
        slots: [],
        activeTerminalId: undefined,
      })
      this.activeTabId = id
      return id
    },

    renameTab(id: string, label: string) {
      const tab = this.tabs.find((t) => t.id === id)
      if (tab) tab.label = label.trim() || tab.label
    },

    removeTab(id: string) {
      if (this.tabs.length <= 1) return
      const idx = this.tabs.findIndex((t) => t.id === id)
      if (idx === -1) return
      this.tabs.splice(idx, 1)
      if (this.activeTabId === id) {
        this.activeTabId = this.tabs[Math.max(0, idx - 1)].id
      }
    },

    setActive(id: string) {
      if (this.tabs.some((t) => t.id === id)) this.activeTabId = id
    },

    // ── Active terminal within a tab ─────────────────────────

    setActiveTerminal(terminalId: string | undefined, tabId?: string) {
      const tab = this._tab(tabId)
      if (tab) tab.activeTerminalId = terminalId
    },

    cycleTerminal(dir: 1 | -1, tabId?: string) {
      const tab = this._tab(tabId)
      if (!tab) return
      const ids = tab.slots.filter((s): s is string => s !== null)
      if (ids.length <= 1) return
      const idx = ids.indexOf(tab.activeTerminalId ?? '')
      tab.activeTerminalId = ids[(idx + dir + ids.length) % ids.length]
    },

    // ── Slot / layout management ─────────────────────────────

    /** Place a terminal in the first empty slot, or append. */
    placeTerminal(terminalId: string, tabId?: string) {
      const tab = this._tab(tabId)
      if (!tab) return
      const emptyIdx = tab.slots.indexOf(null)
      if (emptyIdx !== -1) {
        const next = [...tab.slots]
        next[emptyIdx] = terminalId
        tab.slots = next
      } else {
        tab.slots = [...tab.slots, terminalId]
      }
      tab.activeTerminalId = terminalId
    },

    /** Remove terminal from a tab's slots. */
    removeTerminal(terminalId: string, tabId?: string) {
      // Find the tab if not specified
      const tab = tabId
        ? this.tabs.find((t) => t.id === tabId)
        : this.tabs.find((t) => t.slots.includes(terminalId))
      if (!tab) return

      const idx = tab.slots.indexOf(terminalId)
      if (idx === -1) return

      const next = [...tab.slots]
      next[idx] = null
      // Trim trailing nulls
      while (next.length > 0 && next[next.length - 1] === null) next.pop()
      tab.slots = next

      // Re-assign active terminal
      if (tab.activeTerminalId === terminalId) {
        tab.activeTerminalId = tab.slots.find((s): s is string => s !== null)
      }
    },

    /** Add a new column if the current terminal count exceeds total slots. */
    autoExpand(tabId?: string) {
      const tab = this._tab(tabId)
      if (!tab) return
      const total = tab.columns.reduce((a, b) => a + b, 0)
      if (tab.slots.length > total) {
        tab.columns = [...tab.columns, 1]
      }
    },

    setColumns(columns: number[], tabId?: string) {
      const tab = this._tab(tabId)
      if (tab) tab.columns = columns
    },

    // ── Move / swap within a tab ─────────────────────────────

    swap(id1: string, id2: string, tabId?: string) {
      const tab = this._tab(tabId)
      if (!tab) return
      const i = tab.slots.indexOf(id1)
      const j = tab.slots.indexOf(id2)
      if (i === -1 || j === -1 || i === j) return
      const next = [...tab.slots]
      ;[next[i], next[j]] = [next[j], next[i]]
      tab.slots = next
    },

    /** Move terminal to a specific flat-index slot (may be empty). */
    moveTo(terminalId: string, targetIdx: number, tabId?: string) {
      const tab = this._tab(tabId)
      if (!tab) return
      const i = tab.slots.indexOf(terminalId)
      if (i === -1 || i === targetIdx) return
      const next = [...tab.slots] as (string | null)[]
      while (next.length <= targetIdx) next.push(null)
      const terminal = next[i]
      next[i] = null
      next[targetIdx] = terminal
      while (next.length > 0 && next[next.length - 1] === null) next.pop()
      tab.slots = next
    },

    // ── Move terminal between tabs ───────────────────────────

    moveToTab(terminalId: string, toTabId: string) {
      const fromTab = this.tabs.find((t) => t.slots.includes(terminalId))
      if (!fromTab || fromTab.id === toTabId) return
      this.removeTerminal(terminalId, fromTab.id)
      this.placeTerminal(terminalId, toTabId)
    },

    // ── Private helper ───────────────────────────────────────

    _tab(tabId?: string): WorkspaceTab | undefined {
      return tabId
        ? this.tabs.find((t) => t.id === tabId)
        : this.tabs.find((t) => t.id === this.activeTabId)
    },
  },
})
