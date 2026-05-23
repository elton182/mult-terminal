<template>
  <div class="toolbar">
    <span class="app-name">multerm</span>

    <div class="tabs">
      <div
        v-for="terminal in store.list"
        :key="terminal.id"
        class="tab"
        :class="{ active: activeId === terminal.id, disconnected: !terminal.isConnected }"
        :style="terminal.color ? { borderBottomColor: terminal.color } : {}"
        role="button"
        tabindex="0"
        @click="emit('activate', terminal.id)"
        @keydown.enter="emit('activate', terminal.id)"
      >
        <span class="tab-icon">{{ shellIcon(terminal.shellType) }}</span>
        <span class="tab-title">{{ terminal.title }}</span>
        <button class="tab-close" @click.stop="emit('close', terminal.id)" title="Fechar (Ctrl+W)">✕</button>
      </div>
    </div>

    <div class="right">
      <!-- Presets de layout -->
      <div class="layout-group">
        <button
          v-for="preset in LAYOUT_PRESETS"
          :key="preset.id"
          class="layout-btn"
          :class="{ active: isActiveLayout(preset.columns) }"
          :title="`Layout ${preset.label}  Ctrl+Alt+${preset.shortcutNum}`"
          @click="emit('set-layout', preset.columns)"
        >
          <LayoutIcon :columns="preset.columns" />
        </button>
      </div>

      <div class="divider" />

      <button title="Perfis SSH" @click="emit('open-ssh-manager')">🔒</button>
      <button title="Configurações  Ctrl+," @click="emit('open-settings')">⚙</button>
      <button class="btn-new" title="Novo terminal  Ctrl+T" @click="emit('new-terminal')">+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import { useTerminalsStore } from '@/stores/terminals'
import { LAYOUT_PRESETS } from '@/types/layouts'

const props = defineProps<{ activeId?: string; columns: number[] }>()

const emit = defineEmits<{
  'new-terminal': []
  'set-layout': [columns: number[]]
  activate: [id: string]
  close: [id: string]
  'open-ssh-manager': []
  'open-settings': []
}>()

const store = useTerminalsStore()

function isActiveLayout(cols: number[]) {
  return JSON.stringify(cols) === JSON.stringify(props.columns ?? [1])
}

function shellIcon(type: string) {
  const map: Record<string, string> = {
    cmd: '⊞', powershell: '💠', bash: '$', wsl: '🐧', zsh: '%', fish: '🐟', ssh: '🔒',
  }
  return map[type] ?? '>'
}

const LayoutIcon = defineComponent({
  props: { columns: { type: Array as () => number[], required: true } },
  setup(p) {
    return () => {
      const W = 20, H = 14, GAP = 1
      const cols = p.columns
      const colW = (W - GAP * (cols.length - 1)) / cols.length
      const rects: ReturnType<typeof h>[] = []
      cols.forEach((rows, ci) => {
        const x = ci * (colW + GAP)
        const rowH = (H - GAP * (rows - 1)) / rows
        for (let ri = 0; ri < rows; ri++) {
          rects.push(h('rect', { key: `${ci}-${ri}`, x: x.toFixed(1), y: (ri * (rowH + GAP)).toFixed(1), width: colW.toFixed(1), height: rowH.toFixed(1), rx: '1' }))
        }
      })
      return h('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, fill: 'currentColor', style: 'display:block' }, rects)
    }
  },
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 8px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  user-select: none;
}
.app-name { font-size: 11px; font-weight: 700; color: var(--accent-blue); letter-spacing: 1px; flex-shrink: 0; }

.tabs { flex: 1; display: flex; align-items: center; gap: 2px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; min-width: 0; }
.tabs::-webkit-scrollbar { display: none; }

.tab { display: flex; align-items: center; gap: 5px; padding: 4px 10px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); cursor: pointer; font-size: 12px; white-space: nowrap; border-radius: 4px 4px 0 0; flex-shrink: 0; }
.tab:hover { color: var(--text-primary); background: var(--bg-surface); }
.tab.active { color: var(--text-primary); border-bottom-color: var(--accent-blue); background: var(--bg-base); }
.tab.disconnected { opacity: 0.5; }

.tab-close { background: none; border: none; color: inherit; cursor: pointer; padding: 1px 3px; font-size: 10px; border-radius: 3px; opacity: 0; }
.tab:hover .tab-close { opacity: 0.6; }
.tab-close:hover { background: var(--accent-red-bg); color: var(--accent-red); opacity: 1 !important; }

.right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.layout-group { display: flex; align-items: center; gap: 2px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 2px; }
.layout-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 3px 5px; border-radius: 4px; display: flex; align-items: center; transition: color 0.1s, background 0.1s; }
.layout-btn:hover { color: var(--text-secondary); background: var(--bg-overlay); }
.layout-btn.active { color: var(--accent-blue); background: var(--bg-base); }

.divider { width: 1px; height: 18px; background: var(--border-subtle); margin: 0 2px; }

.right button { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 14px; }
.right button:hover { background: var(--bg-overlay); color: var(--text-primary); }
.btn-new { font-size: 18px !important; font-weight: 300; color: var(--accent-green) !important; padding: 2px 8px !important; }
</style>
