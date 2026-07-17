<template>
  <div class="app" :class="{ 'is-detached': detachedMode }">
    <!-- Janela destacada: barra mínima -->
    <div v-if="detachedMode" class="detached-bar">
      <span class="detached-title">{{ wsStore.activeTab.label }}</span>
      <span class="detached-hint">Janela destacada</span>
      <button class="reattach-btn" title="Reanexar à janela principal" @click="doReattachFromChild">
        ⧉ Reanexar
      </button>
    </div>

    <WorkspaceTabs
      v-else
      @detach="detachTab"
      @reattach="reattachFromMain"
      @focus-detached="focusDetached"
    />

    <Toolbar
      :active-id="wsStore.activeTab.activeTerminalId"
      :columns="wsStore.activeTab.columns"
      @new-terminal="showNewTerminal = true"
      @set-layout="(cols) => wsStore.setColumns(cols)"
      @activate="(id) => wsStore.setActiveTerminal(id)"
      @close="closeTerminal"
      @open-ssh-manager="showSshManager = true"
      @open-settings="showSettings = true"
    />

    <!-- Mantém todos os grids montados: trocar de aba não dispose() o xterm nem perde histórico -->
    <div class="grids">
      <TerminalGrid
        v-for="tab in wsStore.list"
        v-show="tab.id === wsStore.activeTabId"
        :key="tab.id"
        :ref="(el) => setGridRef(tab.id, el)"
        :columns="tab.columns"
        :slots="tab.slots"
        :active-id="tab.activeTerminalId"
        :visible="tab.id === wsStore.activeTabId"
        @new-terminal="showNewTerminal = true"
      />
    </div>

    <NewTerminalModal
      v-if="showNewTerminal"
      @confirm="onNewTerminal"
      @cancel="showNewTerminal = false"
    />

    <SshManager
      v-if="showSshManager"
      @close="showSshManager = false"
    />

    <SettingsModal
      v-if="showSettings"
      @close="showSettings = false"
    />

    <FileTransferPanel v-if="!detachedMode" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTerminalsStore } from '@/stores/terminals'
import { useWorkspacesStore } from '@/stores/workspaces'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { useThemeStore } from '@/stores/theme'
import { LAYOUT_PRESETS } from '@/types/layouts'
import WorkspaceTabs from '@/components/WorkspaceTabs.vue'
import Toolbar from '@/components/Toolbar.vue'
import TerminalGrid from '@/components/TerminalGrid.vue'
import NewTerminalModal from '@/components/NewTerminalModal.vue'
import SshManager from '@/components/SshManager.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import FileTransferPanel from '@/components/FileTransferPanel.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import {
  buildPayload,
  detachedTabIdFromUrl,
  focusDetachedWindow,
  getDetached,
  isDetachedMode,
  killTabTerminals,
  listDetached,
  notifyReattachReady,
  onDetachedClosed,
  onReattachReady,
  onReattachRequest,
  openDetachedWindow,
  putDetached,
  removeDetached,
  requestReattach,
  takeDetached,
  terminalIdsFromTab,
  windowLabelForTab,
} from '@/composables/useDetach'
import type { UnlistenFn } from '@tauri-apps/api/event'

const termStore = useTerminalsStore()
const wsStore   = useWorkspacesStore()
const sshStore  = useSshProfilesStore()
const themeStore = useThemeStore()

const detachedMode = isDetachedMode()
const showNewTerminal = ref(false)
const showSshManager  = ref(false)
const showSettings    = ref(false)

const gridRefs: Record<string, InstanceType<typeof TerminalGrid> | null> = {}
const unlisteners: UnlistenFn[] = []
/** Evita kill ao fechar a child durante reattach. */
let reattaching = false

function setGridRef(tabId: string, el: unknown) {
  gridRefs[tabId] = el as InstanceType<typeof TerminalGrid> | null
}

function collectScrollbacks(tabId: string): Record<string, string> {
  return gridRefs[tabId]?.serializeAll?.() ?? {}
}

onMounted(async () => {
  await themeStore.load()

  if (detachedMode) {
    await hydrateDetachedChild()
    return
  }

  // Main window: sync ghost tabs + listeners
  try {
    wsStore.setDetachedTabs(await listDetached())
  } catch { /* registry may be empty */ }

  unlisteners.push(await onDetachedClosed((tabId) => {
    wsStore.removeDetachedMeta(tabId)
  }))

  unlisteners.push(await onReattachReady(async (tabId) => {
    await finishReattachOnMain(tabId)
  }))
})

onUnmounted(() => {
  unlisteners.forEach((fn) => { void fn() })
})

async function hydrateDetachedChild() {
  const tabId = detachedTabIdFromUrl()
  if (!tabId) return

  const payload = await getDetached(tabId)
  if (!payload) {
    console.error('Payload detached não encontrado:', tabId)
    return
  }

  termStore.setPendingScrollbacks(payload.scrollbacks)
  termStore.hydrate(payload.terminals)
  wsStore.replaceWithSingleTab(payload.tab)

  await getCurrentWindow().setTitle(payload.tab.label || 'Aba destacada')

  // Fechar janela (X) → mata terminais
  const unclose = await getCurrentWindow().onCloseRequested(async (event) => {
    if (reattaching) return
    event.preventDefault()
    const ids = terminalIdsFromTab(wsStore.activeTab)
    try {
      await killTabTerminals(tabId, ids)
    } finally {
      await getCurrentWindow().destroy()
    }
  })
  unlisteners.push(unclose)

  // Pedido de reattach vindo da main
  unlisteners.push(await onReattachRequest(async (id) => {
    if (id === tabId) await doReattachFromChild()
  }))
}

async function detachTab(tabId: string) {
  const tab = wsStore.list.find((t) => t.id === tabId)
  if (!tab) return

  // Ativa a aba para garantir que o grid está visível e serializável
  wsStore.setActive(tabId)
  await nextTick()
  await new Promise((r) => setTimeout(r, 60))

  const scrollbacks = collectScrollbacks(tabId)
  const terminals = termStore.list.filter((t) => tab.slots.includes(t.id))
  const payload = buildPayload(tab, terminals, scrollbacks)

  await putDetached(payload)

  const extracted = wsStore.extractTab(tabId)
  if (!extracted) return

  termStore.detachMeta(terminalIdsFromTab(extracted))

  wsStore.upsertDetachedMeta({
    tabId: extracted.id,
    label: extracted.label,
    windowLabel: windowLabelForTab(extracted.id),
    terminalCount: terminals.length,
  })

  try {
    await openDetachedWindow(extracted)
  } catch (e) {
    // Rollback: reabre aba na main
    console.error(e)
    termStore.setPendingScrollbacks(scrollbacks)
    termStore.hydrate(terminals)
    wsStore.insertTab(extracted)
    wsStore.removeDetachedMeta(extracted.id)
    await removeDetached(extracted.id)
  }
}

async function doReattachFromChild() {
  const tab = wsStore.activeTab
  const tabId = tab.id
  reattaching = true

  await nextTick()
  const scrollbacks = collectScrollbacks(tabId)
  const terminals = termStore.list.filter((t) => tab.slots.includes(t.id))
  const payload = buildPayload(tab, terminals, scrollbacks)
  await putDetached(payload)
  await notifyReattachReady(tabId)
  await getCurrentWindow().destroy()
}

async function finishReattachOnMain(tabId: string) {
  const payload = await takeDetached(tabId)
  if (!payload) return

  termStore.setPendingScrollbacks(payload.scrollbacks)
  termStore.hydrate(payload.terminals)
  wsStore.insertTab(payload.tab, true)
  wsStore.removeDetachedMeta(tabId)
}

async function reattachFromMain(tabId: string) {
  // Pede à child para serializar e fechar; main recebe workspace-reattach-ready
  const focused = await focusDetachedWindow(tabId)
  if (!focused) {
    await finishReattachOnMain(tabId)
    return
  }
  await requestReattach(tabId)
}

async function focusDetached(tabId: string) {
  await focusDetachedWindow(tabId)
}

// ── Prefix-based shortcuts (Ctrl+B → key) ────────────────────────────────────
useKeyboard([
  { key: 't', handler: () => { showNewTerminal.value = true } },

  { key: 'w', handler: () => {
    const id = wsStore.activeTab.activeTerminalId
    if (id) closeTerminal(id)
  }},

  { key: 'n', handler: () => wsStore.cycleTerminal(1) },
  { key: 'p', handler: () => wsStore.cycleTerminal(-1) },

  { key: 'a', handler: () => { if (!detachedMode) wsStore.addTab() } },
  { key: ']', handler: () => {
    if (detachedMode) return
    const tabs = wsStore.list
    const i = tabs.findIndex((t) => t.id === wsStore.activeTabId)
    wsStore.setActive(tabs[(i + 1) % tabs.length].id)
  }},
  { key: '[', handler: () => {
    if (detachedMode) return
    const tabs = wsStore.list
    const i = tabs.findIndex((t) => t.id === wsStore.activeTabId)
    wsStore.setActive(tabs[(i - 1 + tabs.length) % tabs.length].id)
  }},

  { key: ',', handler: () => { showSettings.value = true } },

  ...LAYOUT_PRESETS.map((p) => ({
    key: String(p.shortcutNum),
    handler: () => wsStore.setColumns(p.columns),
  })),
])

async function closeTerminal(id: string) {
  wsStore.removeTerminal(id)
  await termStore.close(id)
}

async function onNewTerminal(opts: { type: string; profileId?: string; password?: string }) {
  showNewTerminal.value = false
  if (opts.type === 'ssh' && opts.profileId) {
    await sshStore.load()
    const profile = sshStore.profiles.find((p) => p.id === opts.profileId)
    if (!profile) return
    try {
      const id = await termStore.openSsh({
        id: crypto.randomUUID(),
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: opts.password ?? '',
        keyPath: profile.authType === 'privatekey' ? (profile.keyPath ?? '~/.ssh/id_rsa') : '',
        name: profile.name,
        color: profile.color,
        profileId: profile.id,
      })
      wsStore.placeTerminal(id)
      wsStore.autoExpand()
    } catch (err) {
      alert(`Erro ao iniciar conexão SSH:\n${err}`)
    }
  } else {
    const id = await termStore.openLocal(opts.type)
    wsStore.placeTerminal(id)
    wsStore.autoExpand()
  }
}
</script>

<style>
:root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
body, #app, .app { width: 100vw; height: 100vh; overflow: hidden; }
.app { display: flex; flex-direction: column; background: var(--bg-base); color: var(--text-primary); }
.grids { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.grids > * { flex: 1; min-height: 0; }

.detached-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 28px;
  padding: 0 10px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.detached-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.detached-hint { font-size: 10px; color: var(--text-muted); flex: 1; }
.reattach-btn {
  background: var(--bg-overlay);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.reattach-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
</style>
