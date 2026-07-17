import { invoke } from '@tauri-apps/api/core'
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { DetachedPayload, DetachedTabMeta, TerminalState, WorkspaceTab } from '@/types'

export function windowLabelForTab(tabId: string): string {
  return `ws-${tabId}`
}

export function isDetachedMode(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('mode') === 'detached') return true
  try {
    return getCurrentWindow().label.startsWith('ws-')
  } catch {
    return false
  }
}

export function detachedTabIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('tab')
  if (fromQuery) return fromQuery
  const label = getCurrentWindow().label
  if (label.startsWith('ws-')) return label.slice(3)
  return null
}

export async function putDetached(payload: DetachedPayload): Promise<void> {
  await invoke('detached_put', { payload })
}

export async function getDetached(tabId: string): Promise<DetachedPayload | null> {
  return invoke<DetachedPayload | null>('detached_get', { tabId })
}

export async function takeDetached(tabId: string): Promise<DetachedPayload | null> {
  return invoke<DetachedPayload | null>('detached_take', { tabId })
}

export async function listDetached(): Promise<DetachedTabMeta[]> {
  return invoke<DetachedTabMeta[]>('detached_list')
}

export async function removeDetached(tabId: string): Promise<void> {
  await invoke('detached_remove', { tabId })
}

export async function killTabTerminals(tabId: string, terminalIds: string[]): Promise<void> {
  await invoke('kill_tab_terminals', { tabId, terminalIds })
}

/** Create OS window for a detached workspace tab. */
export async function openDetachedWindow(tab: WorkspaceTab): Promise<WebviewWindow> {
  const label = windowLabelForTab(tab.id)
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    await existing.setFocus()
    return existing
  }

  const url = `index.html?mode=detached&tab=${encodeURIComponent(tab.id)}`
  const win = new WebviewWindow(label, {
    url,
    title: tab.label || 'Aba destacada',
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 400,
    focus: true,
  })

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout ao abrir janela destacada')), 8000)
    win.once('tauri://created', () => { clearTimeout(t); resolve() })
    win.once('tauri://error', (e) => {
      clearTimeout(t)
      reject(new Error(String(e.payload ?? e)))
    })
  })

  return win
}

export async function focusDetachedWindow(tabId: string): Promise<boolean> {
  const win = await WebviewWindow.getByLabel(windowLabelForTab(tabId))
  if (!win) return false
  await win.setFocus()
  return true
}

export async function closeDetachedWindow(tabId: string): Promise<void> {
  const win = await WebviewWindow.getByLabel(windowLabelForTab(tabId))
  if (win) await win.close()
}

/** Ask child window to serialize + put payload, then close for reattach. */
export async function requestReattach(tabId: string): Promise<void> {
  await emit('workspace-reattach-request', tabId)
}

export async function onReattachRequest(handler: (tabId: string) => void): Promise<UnlistenFn> {
  return listen<string>('workspace-reattach-request', (e) => {
    if (e.payload) handler(e.payload)
  })
}

export async function notifyReattachReady(tabId: string): Promise<void> {
  await emit('workspace-reattach-ready', tabId)
}

export async function onReattachReady(handler: (tabId: string) => void): Promise<UnlistenFn> {
  return listen<string>('workspace-reattach-ready', (e) => {
    if (e.payload) handler(e.payload)
  })
}

export async function onDetachedClosed(handler: (tabId: string) => void): Promise<UnlistenFn> {
  return listen<string>('workspace-detached-closed', (e) => {
    if (e.payload) handler(e.payload)
  })
}

export function terminalIdsFromTab(tab: WorkspaceTab): string[] {
  return tab.slots.filter((s): s is string => s !== null)
}

export function buildPayload(
  tab: WorkspaceTab,
  terminals: TerminalState[],
  scrollbacks: Record<string, string>,
): DetachedPayload {
  const ids = new Set(terminalIdsFromTab(tab))
  return {
    tab: { ...tab, slots: [...tab.slots], columns: [...tab.columns] },
    terminals: terminals.filter((t) => ids.has(t.id)),
    scrollbacks,
    windowLabel: windowLabelForTab(tab.id),
  }
}
