<template>
  <div class="terminal-panel" :style="borderStyle">

    <!-- Alça de drag — sempre visível (4 px), expande no hover -->
    <div class="panel-header">
      <span
        class="drag-handle"
        draggable="true"
        title="Arrastar para mover terminal"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >⠿</span>
    </div>

    <div class="xterm-container" ref="containerRef" />

    <!--
      Overlay transparente exibido em TODOS os painéis (exceto o que está sendo arrastado)
      enquanto um drag está ativo. Fica por cima do xterm e captura dragover/drop
      que o xterm normalmente bloquearia.
    -->
    <div
      v-if="isDragging && !isSource"
      class="drop-overlay"
      :class="{ 'drop-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop.prevent="onDrop"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTerminal } from '@/composables/useTerminal'
import { useTerminalsStore } from '@/stores/terminals'
import { draggingTerminalId } from '@/composables/useDrag'

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

/** Está ocorrendo um drag de algum terminal agora? */
const isDragging = computed(() => draggingTerminalId.value !== null)
/** Este painel é a origem do drag? */
const isSource = computed(() => draggingTerminalId.value === props.terminalId)

const { fit } = useTerminal(
  props.terminalId,
  containerRef,
  props.type,
  () => store.markDisconnected(props.terminalId),
)

function onDragStart(e: DragEvent) {
  draggingTerminalId.value = props.terminalId
  e.dataTransfer?.setData('text/terminal-id', props.terminalId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggingTerminalId.value = null
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  draggingTerminalId.value = null
  const sourceId = e.dataTransfer?.getData('text/terminal-id')
  if (sourceId && sourceId !== props.terminalId) {
    emit('swap', sourceId, props.terminalId)
  }
}

defineExpose({ fit })
</script>

<style scoped>
.terminal-panel {
  position: relative;   /* necessário para o overlay absoluto */
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
}

/* Barra de drag — fica com 4 px, expande para 18 px no hover */
.panel-header {
  display: flex;
  align-items: center;
  height: 4px;
  overflow: hidden;
  background: #010409;
  transition: height 0.15s, border-color 0.15s;
  border-bottom: 1px solid transparent;
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

.drag-handle:hover { color: #8b949e; }
.drag-handle:active { cursor: grabbing; }

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

:deep(.xterm) { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }

/* Overlay de drop — cobre o xterm durante drag */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: transparent;
  transition: background 0.1s, outline 0.1s;
}

.drop-overlay.drop-over {
  background: rgba(88, 166, 255, 0.08);
  outline: 2px solid #58a6ff;
  outline-offset: -2px;
}
</style>
