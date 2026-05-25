<template>
  <div
    class="terminal-panel"
    :class="{ 'is-active': props.terminalId === props.activeId }"
    :style="borderStyle"
    :data-terminal-id="terminalId"
  >
    <!-- Barra de controle — visível no hover -->
    <div class="panel-header">
      <div class="move-btns">
        <button
          v-if="canMove('left')"
          class="mv"
          title="Mover à esquerda"
          @click="move('left')"
        >←</button>
        <button
          v-if="canMove('up')"
          class="mv"
          title="Mover para cima"
          @click="move('up')"
        >↑</button>
        <button
          v-if="canMove('down')"
          class="mv"
          title="Mover para baixo"
          @click="move('down')"
        >↓</button>
        <button
          v-if="canMove('right')"
          class="mv"
          title="Mover à direita"
          @click="move('right')"
        >→</button>
      </div>
      <button class="btn-close" title="Fechar terminal (Ctrl+W)" @click="store.close(terminalId)">✕</button>
    </div>

    <div class="xterm-container" ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTerminal } from '@/composables/useTerminal'
import { useTerminalsStore } from '@/stores/terminals'

const props = defineProps<{
  terminalId: string
  shellType:  string
  color?:     string
  type:       'local' | 'ssh'
  col:        number
  row:        number
  columns:    number[]   // e.g. [2, 3, 1]
  activeId?:  string
}>()

const containerRef = ref<HTMLElement>()
const store = useTerminalsStore()

const borderStyle = computed(() =>
  props.color ? { borderTop: `2px solid ${props.color}` } : {},
)

const { fit } = useTerminal(
  props.terminalId,
  containerRef,
  props.type,
  () => store.markDisconnected(props.terminalId),
)

// ── Posição e navegação ───────────────────────────────────

/** Índice plano no store.list para (col, row) */
function flatIdx(c: number, r: number) {
  let i = 0
  for (let ci = 0; ci < c; ci++) i += props.columns[ci]
  return i + r
}

/**
 * Slot de grade na direção indicada — retorna col/row/idx se o SLOT DE LAYOUT
 * existir, ou null se não houver posição adjacente na grade.
 * (Não requer que haja um terminal no slot — apenas que o layout o preveja.)
 */
function neighborInfo(dir: 'up' | 'down' | 'left' | 'right'): { col: number; row: number; idx: number } | null {
  const { col, row, columns } = props
  let nc: number, nr: number

  if (dir === 'up') {
    if (row <= 0) return null
    nc = col; nr = row - 1

  } else if (dir === 'down') {
    if (row >= columns[col] - 1) return null
    nc = col; nr = row + 1

  } else if (dir === 'left') {
    if (col <= 0) return null
    nc = col - 1; nr = Math.min(row, columns[col - 1] - 1)

  } else { // right
    if (col >= columns.length - 1) return null
    nc = col + 1; nr = Math.min(row, columns[col + 1] - 1)
  }

  return { col: nc, row: nr, idx: flatIdx(nc, nr) }
}

/** Seta aparece sempre que o slot adjacente existe no layout. */
function canMove(dir: 'up' | 'down' | 'left' | 'right') {
  return neighborInfo(dir) !== null
}

/** Move o terminal:
 *  - slot com terminal → troca (swap)
 *  - slot vazio        → move (moveTo)
 */
function move(dir: 'up' | 'down' | 'left' | 'right') {
  const info = neighborInfo(dir)
  if (!info) return
  const target = store.list[info.idx]
  if (target) {
    store.swap(props.terminalId, target.id)
  } else {
    store.moveTo(props.terminalId, info.idx)
  }
}

defineExpose({ fit })
</script>

<style scoped>
.terminal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
  /* Highlight ring for active panel */
  box-shadow: inset 0 0 0 0 transparent;
  transition: box-shadow 0.15s;
}

/* Active panel: subtle inset ring in the accent colour */
.terminal-panel.is-active {
  box-shadow: inset 0 0 0 2px var(--accent-blue);
}

/* Header: 0px colapsado → 22px no hover */
.panel-header {
  display: flex;
  align-items: center;
  height: 0;
  overflow: hidden;
  background: var(--bg-deep);
  border-bottom: 1px solid transparent;
  transition: height 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.terminal-panel:hover .panel-header {
  height: 22px;
  border-bottom-color: var(--border-subtle);
}

.move-btns {
  display: flex;
  gap: 2px;
  padding: 0 6px;
}

.mv {
  background: none;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1.4;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.mv:hover {
  background: var(--bg-overlay);
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

.btn-close {
  margin-left: auto;
  margin-right: 6px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1.4;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.btn-close:hover {
  background: var(--accent-red-bg);
  color: var(--accent-red);
  border-color: var(--accent-red);
}

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

:deep(.xterm)          { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
