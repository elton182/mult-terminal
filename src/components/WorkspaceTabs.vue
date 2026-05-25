<template>
  <div class="ws-bar">
    <div
      v-for="tab in wsStore.list"
      :key="tab.id"
      class="ws-tab"
      :class="{ active: tab.id === wsStore.activeTabId }"
      @click="wsStore.setActive(tab.id)"
      @dblclick="startRename(tab.id, tab.label)"
    >
      <template v-if="renamingId === tab.id">
        <input
          ref="renameInput"
          class="rename-input"
          v-model="renameValue"
          @keydown.enter="commitRename"
          @keydown.escape="renamingId = null"
          @blur="commitRename"
          @click.stop
        />
      </template>
      <template v-else>
        <span class="ws-label">{{ tab.label }}</span>
        <span v-if="tab.slots.filter(Boolean).length" class="ws-count">
          {{ tab.slots.filter(Boolean).length }}
        </span>
        <button
          v-if="wsStore.list.length > 1"
          class="ws-close"
          title="Fechar aba"
          @click.stop="wsStore.removeTab(tab.id)"
        >✕</button>
      </template>
    </div>

    <button class="ws-add" title="Nova aba" @click="wsStore.addTab()">+</button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useWorkspacesStore } from '@/stores/workspaces'

const wsStore = useWorkspacesStore()

const renamingId  = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement>()

async function startRename(id: string, currentLabel: string) {
  renamingId.value  = id
  renameValue.value = currentLabel
  await nextTick()
  renameInput.value?.select()
}

function commitRename() {
  if (renamingId.value) {
    wsStore.renameTab(renamingId.value, renameValue.value)
    renamingId.value = null
  }
}
</script>

<style scoped>
.ws-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 6px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  user-select: none;
}
.ws-bar::-webkit-scrollbar { display: none; }

.ws-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid transparent;
  white-space: nowrap;
  transition: color 0.12s, background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.ws-tab:hover { color: var(--text-secondary); background: var(--bg-overlay); }
.ws-tab.active {
  color: var(--text-primary);
  background: var(--bg-surface);
  border-color: var(--border-subtle);
}

.ws-label { font-weight: 500; }

.ws-count {
  font-size: 9px;
  background: var(--bg-overlay);
  color: var(--text-muted);
  padding: 0 4px;
  border-radius: 8px;
  line-height: 14px;
}
.ws-tab.active .ws-count { background: var(--accent-blue); color: var(--bg-deep); opacity: 0.9; }

.ws-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 9px;
  border-radius: 2px;
  opacity: 0;
  line-height: 1;
  transition: opacity 0.1s, color 0.1s;
}
.ws-tab:hover .ws-close,
.ws-tab.active .ws-close { opacity: 0.6; }
.ws-close:hover { color: var(--accent-red) !important; opacity: 1 !important; }

.ws-add {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 14px;
  font-weight: 300;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}
.ws-add:hover { color: var(--accent-blue); background: var(--bg-overlay); }

.rename-input {
  background: var(--bg-overlay);
  border: 1px solid var(--accent-blue);
  color: var(--text-primary);
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  outline: none;
  width: 80px;
}
</style>
