<template>
  <div class="app">
    <WorkspaceTabs />

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

    <TerminalGrid
      ref="gridRef"
      :columns="wsStore.activeTab.columns"
      :slots="wsStore.activeTab.slots"
      :active-id="wsStore.activeTab.activeTerminalId"
      @new-terminal="showNewTerminal = true"
    />

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

    <FileTransferPanel />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const termStore = useTerminalsStore()
const wsStore   = useWorkspacesStore()
const sshStore  = useSshProfilesStore()
const themeStore = useThemeStore()
const gridRef = ref<InstanceType<typeof TerminalGrid>>()

onMounted(() => themeStore.load())

const showNewTerminal = ref(false)
const showSshManager  = ref(false)
const showSettings    = ref(false)

// ── Prefix-based shortcuts (Ctrl+B → key) ────────────────────────────────────
useKeyboard([
  { key: 't', handler: () => { showNewTerminal.value = true } },

  { key: 'w', handler: () => {
    const id = wsStore.activeTab.activeTerminalId
    if (id) closeTerminal(id)
  }},

  { key: 'n', handler: () => wsStore.cycleTerminal(1) },
  { key: 'p', handler: () => wsStore.cycleTerminal(-1) },

  { key: 'a', handler: () => wsStore.addTab() },
  { key: ']', handler: () => {
    const tabs = wsStore.list
    const i = tabs.findIndex((t) => t.id === wsStore.activeTabId)
    wsStore.setActive(tabs[(i + 1) % tabs.length].id)
  }},
  { key: '[', handler: () => {
    const tabs = wsStore.list
    const i = tabs.findIndex((t) => t.id === wsStore.activeTabId)
    wsStore.setActive(tabs[(i - 1 + tabs.length) % tabs.length].id)
  }},

  { key: ',', handler: () => { showSettings.value = true } },

  // Layout presets: Ctrl+B → 1 … 6
  ...LAYOUT_PRESETS.map((p) => ({
    key: String(p.shortcutNum),
    handler: () => wsStore.setColumns(p.columns),
  })),
])

// ── Terminal lifecycle ────────────────────────────────────────────────────────

async function closeTerminal(id: string) {
  wsStore.removeTerminal(id)       // remove from workspace slot
  await termStore.close(id)        // kill the PTY/SSH process
}

async function onNewTerminal(opts: { type: string; profileId?: string }) {
  showNewTerminal.value = false
  if (opts.type === 'ssh' && opts.profileId) {
    await sshStore.load()
    showSshManager.value = true
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
</style>
