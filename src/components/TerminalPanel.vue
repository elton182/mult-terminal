<template>
  <div
    class="terminal-panel"
    :style="borderStyle"
    :class="{ 'drag-over': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Barra de drag — fica invisível até hover -->
    <div class="panel-header">
      <span
        class="drag-handle"
        draggable="true"
        title="Arrastar para mover terminal"
        @dragstart="onDragStart"
        @dragend="isDragOver = false"
      >⠿</span>
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
  shellType: string
  color?: string
  type: 'local' | 'ssh'
}>()

const emit = defineEmits<{
  swap: [sourceId: string, targetId: string]
}>()

const containerRef = ref<HTMLElement>()
const isDragOver = ref(false)
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

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/terminal-id', props.terminalId)
  // Cursor visual
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const sourceId = e.dataTransfer?.getData('text/terminal-id')
  if (sourceId && sourceId !== props.terminalId) {
    emit('swap', sourceId, props.terminalId)
  }
}

defineExpose({ fit })
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
  transition: outline 0.1s;
}

/* Destaque ao arrastar sobre o painel */
.terminal-panel.drag-over {
  outline: 2px solid #58a6ff;
  outline-offset: -2px;
}

/* Barra de drag — oculta por padrão, aparece no hover */
.panel-header {
  display: flex;
  align-items: center;
  height: 0;
  overflow: hidden;
  transition: height 0.15s;
  background: #010409;
  border-bottom: 1px solid transparent;
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

.drag-handle:hover {
  color: #8b949e;
}

.drag-handle:active {
  cursor: grabbing;
}

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

:deep(.xterm) { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
