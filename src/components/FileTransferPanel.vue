<template>
  <div v-if="store.visible" class="transfer-overlay">
    <div class="transfer-panel">
      <header class="panel-top">
        <div class="title-block">
          <span class="proto-badge" :class="store.protocol">{{ store.protocol.toUpperCase() }}</span>
          <h3>{{ store.title }}</h3>
        </div>
        <button class="btn-close" title="Fechar" @click="store.close()">✕</button>
      </header>

      <div v-if="store.loading" class="status">Conectando...</div>
      <div v-else-if="store.error" class="status error">{{ store.error }}</div>

      <template v-else-if="store.sessionId">
        <div class="toolbar">
          <button :disabled="busy" title="Enviar →" @click="uploadSelected">↑ Enviar</button>
          <button :disabled="busy" title="← Baixar" @click="downloadSelected">↓ Baixar</button>
          <button :disabled="busy" @click="mkdirRemote">+ Pasta remota</button>
          <button :disabled="busy || !selectedRemote" @click="deleteRemote">✕ Remover remoto</button>
        </div>

        <div v-if="store.progress" class="progress-bar-wrap">
          <div class="progress-label">
            <span>{{ progressLabel }}</span>
            <span>{{ progressPercent }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
          </div>
        </div>

        <div class="dual-pane">
          <!-- Local -->
          <section class="pane">
            <div class="pane-header">
              <span class="pane-label">Local</span>
              <div class="crumbs">
                <button class="crumb" title="Pasta pai" @click="goLocalParent">↑</button>
                <input
                  v-model="localPathInput"
                  class="path-input"
                  type="text"
                  spellcheck="false"
                  title="Digite um caminho e pressione Enter"
                  placeholder="C:\Users\..."
                  @keydown.enter="navigateLocal"
                />
                <button class="crumb go" title="Ir para caminho" @click="navigateLocal">→</button>
              </div>
            </div>
            <div class="pane-controls">
              <input
                v-model="localSearch"
                class="search-input"
                type="search"
                placeholder="Buscar..."
                spellcheck="false"
              />
              <select v-model="localSort" class="sort-select" title="Ordenar por">
                <option value="name-asc">Nome A→Z</option>
                <option value="name-desc">Nome Z→A</option>
                <option value="date-desc">Data (recente)</option>
                <option value="date-asc">Data (antiga)</option>
              </select>
            </div>
            <div class="file-list" @dragover.prevent @drop.prevent="onDropToLocal">
              <div
                v-for="entry in displayedLocalEntries"
                :key="entry.path"
                class="file-row"
                :class="{ selected: selectedLocal?.path === entry.path, parent: entry.name === '..' }"
                @click="selectLocal(entry)"
                @dblclick="enterLocal(entry)"
              >
                <span class="icon">{{ entry.name === '..' ? '⬆' : entry.is_dir ? '📁' : '📄' }}</span>
                <span class="name">{{ entry.name }}</span>
                <span class="meta">
                  <span v-if="entry.modified" class="date">{{ formatDate(entry.modified) }}</span>
                  <span class="size">{{ entry.is_dir ? '' : formatSize(entry.size) }}</span>
                </span>
              </div>
              <div v-if="displayedLocalEntries.length === 0" class="empty">
                {{ localSearch ? 'Nenhum resultado' : 'Pasta vazia' }}
              </div>
            </div>
          </section>

          <!-- Remote -->
          <section class="pane">
            <div class="pane-header">
              <span class="pane-label">Remoto</span>
              <div class="crumbs">
                <button class="crumb" title="Pasta pai" @click="goRemoteParent">↑</button>
                <input
                  v-model="remotePathInput"
                  class="path-input"
                  type="text"
                  spellcheck="false"
                  title="Digite um caminho e pressione Enter (ex: /var/www/)"
                  placeholder="/var/www/"
                  @keydown.enter="navigateRemote"
                />
                <button class="crumb go" title="Ir para caminho" @click="navigateRemote">→</button>
              </div>
            </div>
            <div class="pane-controls">
              <input
                v-model="remoteSearch"
                class="search-input"
                type="search"
                placeholder="Buscar..."
                spellcheck="false"
              />
              <select v-model="remoteSort" class="sort-select" title="Ordenar por">
                <option value="name-asc">Nome A→Z</option>
                <option value="name-desc">Nome Z→A</option>
                <option value="date-desc">Data (recente)</option>
                <option value="date-asc">Data (antiga)</option>
              </select>
            </div>
            <div
              class="file-list drop-zone"
              @dragover.prevent
              @drop.prevent="onDropToRemote"
            >
              <div
                v-for="entry in displayedRemoteEntries"
                :key="entry.path"
                class="file-row"
                :class="{ selected: selectedRemote?.path === entry.path, parent: entry.name === '..' }"
                @click="selectRemote(entry)"
                @dblclick="enterRemote(entry)"
              >
                <span class="icon">{{ entry.name === '..' ? '⬆' : entry.is_dir ? '📁' : '📄' }}</span>
                <span class="name">{{ entry.name }}</span>
                <span class="meta">
                  <span v-if="entry.modified" class="date">{{ formatDate(entry.modified) }}</span>
                  <span class="size">{{ entry.is_dir ? '' : formatSize(entry.size) }}</span>
                </span>
              </div>
              <div v-if="displayedRemoteEntries.length === 0" class="empty">
                {{ remoteSearch ? 'Nenhum resultado' : 'Pasta vazia' }}
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useFileTransferStore } from '@/stores/file-transfer'
import type { FileEntry } from '@/types'

const store = useFileTransferStore()

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'

const PARENT_ENTRY: FileEntry = {
  name: '..',
  path: '..',
  is_dir: true,
  size: 0,
  modified: null,
}

const localPath = ref('')
const remotePath = ref('/')
const localPathInput = ref('')
const remotePathInput = ref('/')
const localEntriesRaw = ref<FileEntry[]>([])
const remoteEntriesRaw = ref<FileEntry[]>([])
const selectedLocal = ref<FileEntry | null>(null)
const selectedRemote = ref<FileEntry | null>(null)
const busy = ref(false)
const localSearch = ref('')
const remoteSearch = ref('')
const localSort = ref<SortOption>('name-asc')
const remoteSort = ref<SortOption>('name-asc')

const progressPercent = computed(() => {
  const p = store.progress
  if (!p || p.bytes_total <= 0) return 0
  return Math.min(100, Math.round((p.bytes_done / p.bytes_total) * 100))
})

const progressLabel = computed(() => {
  const p = store.progress
  if (!p) return ''
  const verb = p.direction === 'upload' ? 'Enviando' : 'Baixando'
  return `${verb} ${p.file_name}`
})

function canGoLocalParent(): boolean {
  const p = localPath.value.replace(/\\/g, '/')
  const isWindowsRoot = /^[A-Za-z]:\/?$/.test(p)
  return p !== '/' && !isWindowsRoot
}

function canGoRemoteParent(): boolean {
  return remotePath.value !== '/'
}

function sortAndFilter(entries: FileEntry[], sort: SortOption, search: string): FileEntry[] {
  let list = [...entries]
  const q = search.trim().toLowerCase()
  if (q) {
    list = list.filter((e) => e.name.toLowerCase().includes(q))
  }
  const [key, dir] = sort.split('-') as ['name' | 'date', 'asc' | 'desc']
  list.sort((a, b) => {
    const dirCmp = Number(b.is_dir) - Number(a.is_dir)
    if (dirCmp !== 0) return dirCmp
    let cmp = 0
    if (key === 'date') {
      cmp = (a.modified ?? 0) - (b.modified ?? 0)
    } else {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    return dir === 'asc' ? cmp : -cmp
  })
  return list
}

const displayedLocalEntries = computed(() => {
  const parent = canGoLocalParent() ? [PARENT_ENTRY] : []
  return [...parent, ...sortAndFilter(localEntriesRaw.value, localSort.value, localSearch.value)]
})

const displayedRemoteEntries = computed(() => {
  const parent = canGoRemoteParent() ? [PARENT_ENTRY] : []
  return [...parent, ...sortAndFilter(remoteEntriesRaw.value, remoteSort.value, remoteSearch.value)]
})

watch(
  () => store.sessionId,
  async (id) => {
    if (!id) return
    localPath.value = await store.localHome()
    remotePath.value = '/'
    localPathInput.value = localPath.value
    remotePathInput.value = remotePath.value
    selectedLocal.value = null
    selectedRemote.value = null
    localSearch.value = ''
    remoteSearch.value = ''
    await refreshBoth()
  },
)

watch(localPath, (p) => { localPathInput.value = p })
watch(remotePath, (p) => { remotePathInput.value = p })

async function refreshBoth() {
  await Promise.all([refreshLocal(), refreshRemote()])
}

async function refreshLocal() {
  if (!localPath.value) return
  localEntriesRaw.value = await store.listLocal(localPath.value)
}

async function refreshRemote() {
  if (!store.sessionId) return
  remoteEntriesRaw.value = await store.listRemote(remotePath.value)
}

function normalizeRemotePath(input: string): string {
  let p = input.trim().replace(/\\/g, '/')
  if (!p || p === '/') return '/'
  if (!p.startsWith('/')) p = `/${p}`
  return p.replace(/\/+$/, '') || '/'
}

function normalizeLocalPath(input: string): string {
  return input.trim()
}

async function navigateLocal() {
  const path = normalizeLocalPath(localPathInput.value)
  if (!path) return
  try {
    await store.listLocal(path)
    localPath.value = path
    selectedLocal.value = null
    localSearch.value = ''
    await refreshLocal()
  } catch (e) {
    alert(`Caminho local inválido:\n${e}`)
    localPathInput.value = localPath.value
  }
}

async function navigateRemote() {
  const path = normalizeRemotePath(remotePathInput.value)
  try {
    await store.listRemote(path)
    remotePath.value = path
    selectedRemote.value = null
    remoteSearch.value = ''
    await refreshRemote()
  } catch (e) {
    alert(`Caminho remoto inválido:\n${e}`)
    remotePathInput.value = remotePath.value
  }
}

function selectLocal(entry: FileEntry) {
  selectedLocal.value = entry
}

function selectRemote(entry: FileEntry) {
  selectedRemote.value = entry
}

function enterLocal(entry: FileEntry) {
  if (entry.name === '..') {
    goLocalParent()
    return
  }
  if (!entry.is_dir) return
  localPath.value = entry.path
  selectedLocal.value = null
  localSearch.value = ''
  refreshLocal()
}

function enterRemote(entry: FileEntry) {
  if (entry.name === '..') {
    goRemoteParent()
    return
  }
  if (!entry.is_dir) return
  remotePath.value = entry.path
  selectedRemote.value = null
  remoteSearch.value = ''
  refreshRemote()
}

function goLocalParent() {
  const parts = localPath.value.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) {
    const root = localPath.value.match(/^[A-Za-z]:/) ? `${parts[0]}:\\` : '/'
    localPath.value = root
  } else {
    parts.pop()
    localPath.value = localPath.value.includes('\\')
      ? parts.join('\\')
      : '/' + parts.join('/')
  }
  selectedLocal.value = null
  localSearch.value = ''
  refreshLocal()
}

function goRemoteParent() {
  if (remotePath.value === '/') return
  const parts = remotePath.value.split('/').filter(Boolean)
  parts.pop()
  remotePath.value = parts.length ? '/' + parts.join('/') : '/'
  selectedRemote.value = null
  remoteSearch.value = ''
  refreshRemote()
}

function joinRemote(name: string) {
  if (remotePath.value === '/') return `/${name}`
  return `${remotePath.value.replace(/\/$/, '')}/${name}`
}

function joinLocal(name: string) {
  const sep = localPath.value.includes('\\') ? '\\' : '/'
  const base = localPath.value.replace(/[\\/]+$/, '')
  return `${base}${sep}${name}`
}

async function uploadSelected() {
  if (!selectedLocal.value || selectedLocal.value.is_dir || selectedLocal.value.name === '..') return
  busy.value = true
  try {
    const remote = joinRemote(selectedLocal.value.name)
    await store.upload(selectedLocal.value.path, remote)
    await refreshRemote()
  } catch (e) {
    alert(`Erro no upload: ${e}`)
  } finally {
    busy.value = false
  }
}

async function downloadSelected() {
  if (!selectedRemote.value || selectedRemote.value.is_dir || selectedRemote.value.name === '..') return
  busy.value = true
  try {
    const local = joinLocal(selectedRemote.value.name)
    await store.download(selectedRemote.value.path, local)
    await refreshLocal()
  } catch (e) {
    alert(`Erro no download: ${e}`)
  } finally {
    busy.value = false
  }
}

async function onDropToRemote(e: DragEvent) {
  const dropped = e.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined
  if (!dropped?.path) return
  busy.value = true
  try {
    await store.upload(dropped.path, joinRemote(dropped.name))
    await refreshRemote()
  } catch (err) {
    alert(`Erro no upload: ${err}`)
  } finally {
    busy.value = false
  }
}

async function onDropToLocal(e: DragEvent) {
  if (!selectedRemote.value || selectedRemote.value.is_dir) return
  busy.value = true
  try {
    await store.download(selectedRemote.value.path, joinLocal(selectedRemote.value.name))
    await refreshLocal()
  } catch (err) {
    alert(`Erro no download: ${err}`)
  } finally {
    busy.value = false
  }
}

async function mkdirRemote() {
  const name = prompt('Nome da nova pasta remota:')
  if (!name?.trim()) return
  busy.value = true
  try {
    await store.mkdirRemote(joinRemote(name.trim()))
    await refreshRemote()
  } catch (e) {
    alert(`Erro: ${e}`)
  } finally {
    busy.value = false
  }
}

async function deleteRemote() {
  if (!selectedRemote.value || selectedRemote.value.name === '..') return
  const label = selectedRemote.value.is_dir ? 'pasta' : 'arquivo'
  if (!confirm(`Excluir ${label} "${selectedRemote.value.name}"?`)) return
  busy.value = true
  try {
    await store.deleteRemote(selectedRemote.value.path, selectedRemote.value.is_dir)
    selectedRemote.value = null
    await refreshRemote()
  } catch (e) {
    alert(`Erro: ${e}`)
  } finally {
    busy.value = false
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.transfer-overlay {
  position: fixed;
  inset: 0;
  background: #00000088;
  z-index: 80;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 24px;
}
.transfer-panel {
  flex: 1;
  max-width: 1100px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.title-block { display: flex; align-items: center; gap: 10px; }
.title-block h3 { font-size: 14px; color: var(--text-primary); margin: 0; }
.proto-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.proto-badge.sftp { background: #1f3d2a; color: #3fb950; }
.proto-badge.ftp  { background: #3d2f1f; color: #d29922; }
.btn-close {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px;
}
.btn-close:hover { background: var(--bg-overlay); color: var(--accent-red); }

.status { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
.status.error { color: var(--accent-red); }

.toolbar {
  display: flex; gap: 8px; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--border-subtle);
}
.toolbar button {
  background: var(--bg-overlay); border: 1px solid var(--border-default);
  color: var(--text-primary); font-size: 12px; padding: 4px 10px;
  border-radius: 5px; cursor: pointer;
}
.toolbar button:hover:not(:disabled) { border-color: var(--accent-blue); color: var(--accent-blue); }
.toolbar button:disabled { opacity: 0.4; cursor: default; }

.progress-bar-wrap {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-deep);
}
.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.progress-track {
  height: 6px;
  background: var(--bg-overlay);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent-blue);
  border-radius: 3px;
  transition: width 0.15s ease;
}

.dual-pane {
  flex: 1; display: grid; grid-template-columns: 1fr 1fr;
  min-height: 0; gap: 1px; background: var(--border-subtle);
}
.pane {
  display: flex; flex-direction: column; min-height: 0;
  background: var(--bg-base);
}
.pane-header {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-deep);
}
.pane-label {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; flex-shrink: 0;
}
.crumbs { flex: 1; display: flex; align-items: center; gap: 4px; min-width: 0; }
.crumb {
  background: none; border: 1px solid var(--border-subtle); color: var(--text-muted);
  cursor: pointer; padding: 0 6px; height: 22px; border-radius: 3px; font-size: 11px;
  flex-shrink: 0;
}
.crumb:hover { color: var(--accent-blue); border-color: var(--accent-blue); }
.crumb.go { font-weight: 600; }
.path-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  padding: 0 8px;
  border-radius: 3px;
  outline: none;
}
.path-input:focus { border-color: var(--accent-blue); color: var(--text-primary); }

.pane-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-deep);
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 0 8px;
  border-radius: 3px;
  outline: none;
}
.search-input:focus { border-color: var(--accent-blue); color: var(--text-primary); }
.sort-select {
  height: 22px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 0 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}
.sort-select:focus { border-color: var(--accent-blue); }

.file-list { flex: 1; overflow-y: auto; padding: 4px; }
.drop-zone { outline: none; }
.file-row {
  display: grid; grid-template-columns: 24px 1fr auto;
  gap: 8px; align-items: center;
  padding: 4px 8px; border-radius: 4px; cursor: pointer;
  font-size: 12px; color: var(--text-secondary);
}
.file-row.parent { color: var(--text-muted); font-style: italic; }
.file-row:hover { background: var(--bg-overlay); }
.file-row.selected { background: #1f3d5e; color: var(--text-primary); }
.icon { text-align: center; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.date { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.size { font-size: 10px; color: var(--text-muted); min-width: 48px; text-align: right; }
.empty { padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px; }
</style>
