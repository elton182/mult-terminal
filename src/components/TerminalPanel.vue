<template>
  <div
    class="terminal-panel"
    :class="{ 'is-active': terminalId === activeId }"
    :style="topBorder"
    :data-terminal-id="terminalId"
  >
    <!-- ── Header sempre visível ─────────────────────────── -->
    <div class="panel-header">
      <!-- Botões de direção -->
      <div class="move-btns">
        <button v-if="canMove('left')"  class="mv" title="Mover à esquerda" @click="move('left')">←</button>
        <button v-if="canMove('up')"    class="mv" title="Mover para cima"   @click="move('up')">↑</button>
        <button v-if="canMove('down')"  class="mv" title="Mover para baixo"  @click="move('down')">↓</button>
        <button v-if="canMove('right')" class="mv" title="Mover à direita"  @click="move('right')">→</button>
      </div>

      <!-- Label / nome -->
      <div class="panel-name">
        <span
          v-if="terminal?.color"
          class="color-dot"
          :style="{ background: terminal.color }"
        />
        <span class="name-text" :title="terminal?.title">
          {{ terminal?.label || terminal?.title || shellType }}
        </span>
      </div>

      <!-- Ações direita -->
      <div class="right-btns">
        <button
          v-if="type === 'ssh' && terminal?.isConnected"
          class="btn-icon"
          title="Painel SFTP (usa conexão SSH aberta)"
          @click="openTransfer"
        >📁</button>
        <!-- Mover para outra aba -->
        <div v-if="otherTabs.length" class="tab-move-wrap">
          <button class="btn-icon" title="Mover para aba" @click="showTabMenu = !showTabMenu">⊞</button>
          <div v-if="showTabMenu" class="tab-menu" @mouseleave="showTabMenu = false">
            <div
              v-for="tab in otherTabs"
              :key="tab.id"
              class="tab-menu-item"
              @click="moveToTab(tab.id)"
            >→ {{ tab.label }}</div>
          </div>
        </div>

        <!-- Editar label / cor -->
        <div class="edit-wrap">
          <button class="btn-icon" title="Editar label e cor" @click="toggleEdit">✎</button>
          <div v-if="showEdit" class="edit-popover" @mousedown.stop>
            <input
              ref="labelInputRef"
              v-model="editLabel"
              class="edit-input"
              placeholder="Label (vazio = padrão)"
              @keydown.enter="saveEdit"
              @keydown.escape="showEdit = false"
            />
            <div class="color-row">
              <span
                class="color-opt clear"
                title="Sem cor"
                :class="{ sel: !editColor }"
                @click="editColor = undefined"
              >✕</span>
              <span
                v-for="c in COLORS"
                :key="c"
                class="color-opt"
                :style="{ background: c }"
                :class="{ sel: editColor === c }"
                @click="editColor = c"
              />
            </div>
            <button class="edit-save" @click="saveEdit">OK</button>
          </div>
        </div>

        <button class="btn-close" title="Fechar terminal (Ctrl+W)" @click="closeThis">✕</button>
      </div>
    </div>

    <div class="xterm-container" ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useTerminal } from '@/composables/useTerminal'
import { useTerminalsStore } from '@/stores/terminals'
import { useWorkspacesStore } from '@/stores/workspaces'
import { useFileTransferStore } from '@/stores/file-transfer'

const COLORS = ['#58a6ff','#3fb950','#ff7b72','#d29922','#bc8cff','#76e3ea','#f97316','#ff6b6b','#39d353']

const props = defineProps<{
  terminalId: string
  shellType:  string
  color?:     string
  label?:     string
  type:       'local' | 'ssh'
  col:        number
  row:        number
  columns:    number[]
  activeId?:  string
}>()

const containerRef  = ref<HTMLElement>()
const termStore     = useTerminalsStore()
const wsStore       = useWorkspacesStore()
const transferStore = useFileTransferStore()

// Reactive terminal state (label/color may change)
const terminal = computed(() => termStore.byId(props.terminalId))

const topBorder = computed(() =>
  props.color ? { borderTop: `2px solid ${props.color}` } : {},
)

const { fit } = useTerminal(
  props.terminalId,
  containerRef,
  props.type,
  () => termStore.markDisconnected(props.terminalId),
)

// ── Close ─────────────────────────────────────────────────

async function closeThis() {
  wsStore.removeTerminal(props.terminalId)
  await termStore.close(props.terminalId)
}

// ── Move between workspace tabs ───────────────────────────

const showTabMenu = ref(false)

const otherTabs = computed(() =>
  wsStore.list.filter((t) => t.id !== wsStore.activeTabId),
)

function moveToTab(toTabId: string) {
  showTabMenu.value = false
  wsStore.moveToTab(props.terminalId, toTabId)
}

// ── Edit label / color ────────────────────────────────────

const showEdit     = ref(false)
const editLabel    = ref('')
const editColor    = ref<string | undefined>()
const labelInputRef = ref<HTMLInputElement>()

async function toggleEdit() {
  showEdit.value = !showEdit.value
  if (showEdit.value) {
    editLabel.value = terminal.value?.label ?? ''
    editColor.value = terminal.value?.color
    await nextTick()
    labelInputRef.value?.focus()
  }
}

function saveEdit() {
  termStore.setLabel(props.terminalId, editLabel.value)
  termStore.setColor(props.terminalId, editColor.value)
  showEdit.value = false
}

function openTransfer() {
  if (props.type !== 'ssh' || !terminal.value?.isConnected) return
  const title = terminal.value.label || terminal.value.title || 'SFTP'
  transferStore.openFromSshTerminal(props.terminalId, title)
}

// ── Navigation (move within workspace grid) ───────────────

function flatIdx(c: number, r: number) {
  let i = 0
  for (let ci = 0; ci < c; ci++) i += props.columns[ci]
  return i + r
}

function neighborInfo(dir: 'up' | 'down' | 'left' | 'right'): { idx: number } | null {
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
  } else {
    if (col >= columns.length - 1) return null
    nc = col + 1; nr = Math.min(row, columns[col + 1] - 1)
  }
  return { idx: flatIdx(nc, nr) }
}

function canMove(dir: 'up' | 'down' | 'left' | 'right') {
  return neighborInfo(dir) !== null
}

function move(dir: 'up' | 'down' | 'left' | 'right') {
  const info = neighborInfo(dir)
  if (!info) return
  const targetId = wsStore.activeTab.slots[info.idx]
  if (targetId) {
    wsStore.swap(props.terminalId, targetId)
  } else {
    wsStore.moveTo(props.terminalId, info.idx)
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
  box-shadow: inset 0 0 0 0 transparent;
  transition: box-shadow 0.15s;
}
.terminal-panel.is-active {
  box-shadow: inset 0 0 0 2px var(--accent-blue);
}

/* ── Header: sempre visível, altura fixa ─── */
.panel-header {
  display: flex;
  align-items: center;
  height: 22px;
  flex-shrink: 0;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border-subtle);
  gap: 4px;
  padding: 0 4px;
  overflow: visible;
}

.move-btns { display: flex; gap: 2px; }

.mv {
  background: none;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 5px;
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 1;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.mv:hover { background: var(--bg-overlay); color: var(--accent-blue); border-color: var(--accent-blue); }

/* Label */
.panel-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 0 4px;
}
.color-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.name-text {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Right buttons */
.right-btns { display: flex; align-items: center; gap: 2px; }

.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 5px;
  height: 16px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1;
  transition: background 0.1s, color 0.1s;
}
.btn-icon:hover { background: var(--bg-overlay); color: var(--text-primary); }

.btn-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 5px;
  height: 16px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1;
  transition: background 0.1s, color 0.1s;
}
.btn-close:hover { background: var(--accent-red-bg); color: var(--accent-red); }

/* ── Tab-move dropdown ─── */
.tab-move-wrap { position: relative; }
.tab-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 4px;
  z-index: 100;
  min-width: 110px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tab-menu-item {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.tab-menu-item:hover { background: var(--bg-overlay); color: var(--accent-blue); }

/* ── Edit popover ─── */
.edit-wrap { position: relative; }
.edit-popover {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px;
  z-index: 100;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.edit-input {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 5px;
  outline: none;
  width: 100%;
}
.edit-input:focus { border-color: var(--accent-blue); }

.color-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.color-opt {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s, outline 0.1s;
  outline: 2px solid transparent;
  outline-offset: 2px;
}
.color-opt:hover { transform: scale(1.15); }
.color-opt.sel   { outline-color: var(--text-primary); }
.color-opt.clear {
  background: var(--bg-overlay) !important;
  border: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: var(--text-muted);
  border-radius: 50%;
}
.edit-save {
  align-self: flex-end;
  background: var(--accent-green-dark);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.edit-save:hover { background: var(--accent-green-hover); }

/* ── xterm ─── */
.xterm-container { flex: 1; overflow: hidden; padding: 4px; }
:deep(.xterm)          { height: 100%; }
:deep(.xterm-viewport) { overflow-y: auto !important; }
</style>
