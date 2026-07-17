<template>
  <div class="grid-wrap">
    <splitpanes
      v-if="totalSlots > 0"
      class="outer-panes"
      :horizontal="false"
      @resized="fitAll"
    >
      <pane
        v-for="(rowCount, ci) in columns"
        :key="`col-${ci}`"
        :min-size="5"
      >
        <!-- Single row column: render directly without nested splitpanes -->
        <template v-if="rowCount === 1">
          <TerminalPanel
            v-if="terminalAt(ci, 0)"
            :key="terminalAt(ci, 0)!.id"
            :ref="(el) => setRef(terminalAt(ci, 0)!.id, el)"
            :terminal-id="terminalAt(ci, 0)!.id"
            :shell-type="terminalAt(ci, 0)!.shellType"
            :color="terminalAt(ci, 0)!.color"
            :label="terminalAt(ci, 0)!.label"
            :type="terminalAt(ci, 0)!.type"
            :col="ci"
            :row="0"
            :columns="columns"
            :active-id="activeId"
          />
          <EmptySlot v-else @open="emit('new-terminal')" />
        </template>

        <!-- Multi-row column: nested horizontal splitpanes -->
        <splitpanes
          v-else
          :horizontal="true"
          @resized="fitAll"
        >
          <pane
            v-for="ri in rowCount"
            :key="`row-${ri - 1}`"
            :min-size="5"
          >
            <TerminalPanel
              v-if="terminalAt(ci, ri - 1)"
              :key="terminalAt(ci, ri - 1)!.id"
              :ref="(el) => setRef(terminalAt(ci, ri - 1)!.id, el)"
              :terminal-id="terminalAt(ci, ri - 1)!.id"
              :shell-type="terminalAt(ci, ri - 1)!.shellType"
              :color="terminalAt(ci, ri - 1)!.color"
              :label="terminalAt(ci, ri - 1)!.label"
              :type="terminalAt(ci, ri - 1)!.type"
              :col="ci"
              :row="ri - 1"
              :columns="columns"
              :active-id="activeId"
            />
            <EmptySlot v-else @open="emit('new-terminal')" />
          </pane>
        </splitpanes>
      </pane>
    </splitpanes>

    <!-- Empty workspace -->
    <div v-else class="empty">
      <div class="empty-icon">⬛</div>
      <p>Nenhum terminal aberto</p>
      <p class="hint">Pressione <kbd>Ctrl+T</kbd> ou clique em +</p>
      <button @click="emit('new-terminal')">+ Novo Terminal</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useTerminalsStore } from '@/stores/terminals'
import TerminalPanel from './TerminalPanel.vue'
import type { TerminalState } from '@/types'

const props = defineProps<{
  columns:  number[]           // e.g. [2, 3, 1]
  slots:    (string | null)[]  // terminal IDs from workspace store
  activeId?: string
  /** false enquanto a aba está oculta (v-show) — ao voltar, re-fit */
  visible?: boolean
}>()

const emit = defineEmits<{ 'new-terminal': [] }>()

const termStore = useTerminalsStore()
const panelRefs: Record<string, InstanceType<typeof TerminalPanel> | null> = {}

const totalSlots = computed(() =>
  props.columns.reduce((a, b) => a + b, 0),
)

/** Terminal at grid position (col, row) — looked up from workspace slots. */
function terminalAt(col: number, row: number): TerminalState | null {
  let idx = 0
  for (let c = 0; c < col; c++) idx += props.columns[c]
  idx += row
  const id = props.slots[idx]
  if (!id) return null
  return termStore.byId(id) ?? null
}

function setRef(id: string, el: unknown) {
  panelRefs[id] = el as InstanceType<typeof TerminalPanel> | null
}

function fitAll(force = false) {
  Object.values(panelRefs).forEach((p) => p?.fit(force))
}

function serializeAll(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, panel] of Object.entries(panelRefs)) {
    if (!panel) continue
    const s = panel.serialize?.()
    if (s) out[id] = s
  }
  return out
}

// Ao reexibir a aba (v-show), o container volta a ter tamanho — força re-fit
watch(
  () => props.visible,
  (v) => {
    if (v) nextTick(() => fitAll(true))
  },
)

const EmptySlot = defineComponent({
  emits: ['open'],
  setup(_, { emit }) {
    return () =>
      h('div', {
        class: 'empty-slot',
        onClick: () => emit('open'),
      }, [
        h('span', { class: 'empty-slot-plus' }, '+'),
        h('span', { class: 'empty-slot-label' }, 'Novo terminal'),
      ])
  },
})

defineExpose({ fitAll, serializeAll })
</script>

<style scoped>
.grid-wrap {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.outer-panes {
  flex: 1;
  height: 100%;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.empty-icon { font-size: 40px; opacity: 0.3; }
.empty p { font-size: 14px; }
.hint { font-size: 12px; }
kbd {
  background: var(--bg-overlay);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
}
.empty button {
  margin-top: 4px;
  padding: 7px 18px;
  background: var(--accent-green-dark);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.empty button:hover { background: var(--accent-green-hover); }

/* Splitpanes overrides */
:deep(.splitpanes__splitter) {
  background: var(--border-subtle) !important;
  border: none !important;
  position: relative;
  z-index: 1;
}
:deep(.splitpanes__splitter::before) {
  content: '';
  position: absolute;
  inset: -3px;
}
:deep(.splitpanes__splitter:hover),
:deep(.splitpanes__splitter:active) {
  background: var(--accent-blue) !important;
}
:deep(.splitpanes--horizontal > .splitpanes__splitter) {
  height: 4px !important;
  cursor: row-resize !important;
}
:deep(.splitpanes--vertical > .splitpanes__splitter) {
  width: 4px !important;
  cursor: col-resize !important;
}
</style>

<style>
.empty-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  color: var(--border-default);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  background: var(--bg-base);
}
.empty-slot:hover { color: var(--accent-blue); background: var(--bg-surface); }
.empty-slot-plus  { font-size: 32px; font-weight: 200; line-height: 1; }
.empty-slot-label { font-size: 11px; letter-spacing: 0.5px; }
</style>
