<template>
  <div class="terminal-panel" :style="borderStyle">
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

defineExpose({ fit })
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
}

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

:deep(.xterm) { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
