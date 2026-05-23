<template>
  <div
    class="terminal-panel"
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

/** Terminal vizinho na direção — null se não existe slot válido com terminal */
function neighbor(dir: 'up' | 'down' | 'left' | 'right') {
  const { col, row, columns } = props

  if (dir === 'up') {
    // deve haver uma linha acima dentro da mesma coluna
    if (row <= 0) return null
    return store.list[flatIdx(col, row - 1)] ?? null
  }

  if (dir === 'down') {
    // deve haver uma linha abaixo dentro da mesma coluna
    if (row >= columns[col] - 1) return null
    return store.list[flatIdx(col, row + 1)] ?? null
  }

  if (dir === 'left') {
    if (col <= 0) return null
    const r = Math.min(row, columns[col - 1] - 1)
    return store.list[flatIdx(col - 1, r)] ?? null
  }

  // right
  if (col >= columns.length - 1) return null
  const r = Math.min(row, columns[col + 1] - 1)
  return store.list[flatIdx(col + 1, r)] ?? null
}

function canMove(dir: 'up' | 'down' | 'left' | 'right') {
  return neighbor(dir) !== null
}

function move(dir: 'up' | 'down' | 'left' | 'right') {
  const target = neighbor(dir)
  if (target) store.swap(props.terminalId, target.id)
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
