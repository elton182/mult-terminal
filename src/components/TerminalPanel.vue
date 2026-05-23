<template>
  <div
    class="terminal-panel"
    :class="{ 'drop-over': isOver }"
    :style="borderStyle"
    :data-terminal-id="terminalId"
  >
    <!-- Alça de drag: 4 px colapsada, 18 px no hover -->
    <div class="panel-header">
      <span
        class="drag-handle"
        title="Arrastar para mover terminal"
        @pointerdown.prevent="onPointerDown"
      >⠿</span>
    </div>

    <div class="xterm-container" ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTerminal } from '@/composables/useTerminal'
import { useTerminalsStore } from '@/stores/terminals'
import { startDrag, draggingId, overTargetId } from '@/composables/useDrag'

const props = defineProps<{
  terminalId: string
  shellType: string
  color?: string
  type: 'local' | 'ssh'
}>()

const containerRef = ref<HTMLElement>()
const store = useTerminalsStore()

const borderStyle = computed(() =>
  props.color ? { borderTop: `2px solid ${props.color}` } : {},
)

/** Este painel é o destino atual do drag? */
const isOver = computed(
  () =>
    overTargetId.value === props.terminalId &&
    draggingId.value !== props.terminalId,
)

const { fit } = useTerminal(
  props.terminalId,
  containerRef,
  props.type,
  () => store.markDisconnected(props.terminalId),
)

function onPointerDown(e: PointerEvent) {
  startDrag(props.terminalId, props.shellType, e, (a, b) => store.swap(a, b))
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
  background: #0d1117;
  transition: outline 0.08s;
}

.terminal-panel.drop-over {
  outline: 2px solid #58a6ff;
  outline-offset: -2px;
}

/* Header colapsado (4 px) → 18 px no hover */
.panel-header {
  display: flex;
  align-items: center;
  height: 4px;
  overflow: hidden;
  background: #010409;
  border-bottom: 1px solid transparent;
  transition: height 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.terminal-panel:hover .panel-header {
  height: 18px;
  border-bottom-color: #21262d;
}

.drag-handle {
  color: #30363d;
  cursor: grab;
  padding: 0 8px;
  font-size: 14px;
  line-height: 1;
  user-select: none;
  transition: color 0.1s;
}

.drag-handle:hover  { color: #8b949e; }
.drag-handle:active { cursor: grabbing; }

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

:deep(.xterm)          { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
