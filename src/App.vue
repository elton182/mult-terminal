<template>
  <div class="app">
    <Toolbar
      :active-id="activeId"
      :columns="columns"
      @new-terminal="showNewTerminal = true"
      @set-layout="setLayout"
      @activate="(id) => (activeId = id)"
      @close="closeTerminal"
      @open-ssh-manager="showSshManager = true"
      @open-settings="showSettings = true"
    />

    <TerminalGrid
      ref="gridRef"
      :columns="columns"
      :active-id="activeId"
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTerminalsStore } from '@/stores/terminals'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { useThemeStore } from '@/stores/theme'
import { LAYOUT_PRESETS } from '@/types/layouts'
import Toolbar from '@/components/Toolbar.vue'
import TerminalGrid from '@/components/TerminalGrid.vue'
import NewTerminalModal from '@/components/NewTerminalModal.vue'
import SshManager from '@/components/SshManager.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import { useKeyboard as useKb } from '@/composables/useKeyboard'

const store = useTerminalsStore()
const sshStore = useSshProfilesStore()
const themeStore = useThemeStore()
const gridRef = ref<InstanceType<typeof TerminalGrid>>()

onMounted(() => themeStore.load())

const columns = ref<number[]>([1])
const activeId = ref<string>()
const showNewTerminal = ref(false)
const showSshManager = ref(false)
const showSettings = ref(false)

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
useKb([
  { key: 't', ctrl: true,
    handler: () => { showNewTerminal.value = true } },

  { key: 'w', ctrl: true,
    handler: () => { if (activeId.value) closeTerminal(activeId.value) } },

  { key: 'Tab', ctrl: true, shift: false,
    handler: () => cycleTerminal(1) },

  { key: 'Tab', ctrl: true, shift: true,
    handler: () => cycleTerminal(-1) },

  { key: ',', ctrl: true,
    handler: () => { showSettings.value = true } },

  // Layout presets Ctrl+Alt+1-6
  ...LAYOUT_PRESETS.map((p) => ({
    key: String(p.shortcutNum),
    ctrl: true,
    alt: true,
    handler: () => setLayout(p.columns),
  })),
])

// ── Layout ────────────────────────────────────────────────────────────────────
function setLayout(cols: number[]) {
  columns.value = cols
  // Auto-open terminals to fill new slots if needed
  const totalSlots = cols.reduce((a, b) => a + b, 0)
  const missing = totalSlots - store.list.length
  if (missing > 0) {
    // Just update layout — empty slots show "+" button
  }
}

// ── Active tab tracking ───────────────────────────────────────────────────────
watch(() => store.activeTerminals, (list) => {
  if (list.length === 0) { activeId.value = undefined; return }
  if (!list.find((t) => t.id === activeId.value)) {
    activeId.value = list[list.length - 1]?.id
  }
})

function cycleTerminal(dir: 1 | -1) {
  const list = store.activeTerminals
  if (list.length <= 1) return
  const idx = list.findIndex((t) => t.id === activeId.value)
  activeId.value = list[(idx + dir + list.length) % list.length].id
}

async function closeTerminal(id: string) {
  await store.close(id)
  cycleTerminal(-1)
}

async function onNewTerminal(opts: { type: string; profileId?: string }) {
  showNewTerminal.value = false
  if (opts.type === 'ssh' && opts.profileId) {
    await sshStore.load()
    showSshManager.value = true
  } else {
    const id = await store.openLocal(opts.type)
    activeId.value = id
    // Auto-expand layout: if the new terminal didn't fit, add a new column
    const total = columns.value.reduce((a, b) => a + b, 0)
    if (store.list.length > total) {
      columns.value = [...columns.value, 1]
    }
  }
}
</script>

<style>
:root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
body, #app, .app { width: 100vw; height: 100vh; overflow: hidden; }
.app { display: flex; flex-direction: column; background: var(--bg-base); color: var(--text-primary); }
</style>
