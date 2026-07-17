<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel">
      <div class="panel-header">
        <h3>Perfis remotos</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="profiles">
        <!-- Sem filtro de pasta selecionado: mostrar por pastas -->
        <template v-if="folders.length > 0">
          <!-- Perfis sem pasta -->
          <template v-if="unfoldered.length">
            <div
              v-for="profile in unfoldered"
              :key="profile.id"
              class="profile-card"
              :style="profile.color ? { borderLeftColor: profile.color } : {}"
            >
              <ProfileRow :profile="profile" @connect="connect" @transfer="openTransfer" @edit="openForm" @remove="remove" />
            </div>
          </template>

          <!-- Grupos por pasta -->
          <div v-for="folder in folders" :key="folder" class="folder-group">
            <div class="folder-header" @click="toggleFolder(folder)">
              <span>{{ collapsedFolders.has(folder) ? '▶' : '▼' }}</span>
              <span>{{ folder }}</span>
              <span class="folder-count">{{ profilesByFolder[folder].length }}</span>
            </div>
            <template v-if="!collapsedFolders.has(folder)">
              <div
                v-for="profile in profilesByFolder[folder]"
                :key="profile.id"
                class="profile-card indented"
                :style="profile.color ? { borderLeftColor: profile.color } : {}"
              >
                <ProfileRow :profile="profile" @connect="connect" @transfer="openTransfer" @edit="openForm" @remove="remove" />
              </div>
            </template>
          </div>
        </template>

        <!-- Sem pastas: lista plana -->
        <template v-else>
          <div
            v-for="profile in profiles"
            :key="profile.id"
            class="profile-card"
            :style="profile.color ? { borderLeftColor: profile.color } : {}"
          >
            <ProfileRow :profile="profile" @connect="connect" @transfer="openTransfer" @edit="openForm" @remove="remove" />
          </div>
        </template>

        <div v-if="profiles.length === 0" class="empty-profiles">
          Nenhum perfil SSH. Clique em "+ Novo" para adicionar.
        </div>
      </div>

      <button class="btn-new" @click="openForm()">+ Novo perfil</button>

      <!-- Modal de transferência (SFTP/FTP) -->
      <div v-if="transferTarget" class="form-overlay" @click.self="transferTarget = null">
        <div class="form">
          <h4>{{ transferTarget.protocol === 'ftp' ? 'FTP' : 'SFTP' }} — {{ transferTarget.name }}</h4>
          <div class="row">
            <label>Host</label>
            <input :value="`${transferTarget.username}@${transferTarget.host}:${transferTarget.port}`" disabled />
          </div>
          <template v-if="transferTarget.authType === 'password' || transferTarget.protocol === 'ftp'">
            <div class="row">
              <label>Senha</label>
              <input v-model="transferPassword" type="password" placeholder="Digite a senha" autofocus @keydown.enter="doTransfer" />
            </div>
          </template>
          <template v-else>
            <div class="row">
              <label>Chave privada</label>
              <input :value="transferTarget.keyPath || '~/.ssh/id_rsa'" disabled />
            </div>
            <div class="row">
              <label>Passphrase</label>
              <input v-model="transferPassword" type="password" placeholder="Digite a passphrase" autofocus @keydown.enter="doTransfer" />
            </div>
          </template>
          <div class="form-actions">
            <button @click="transferTarget = null">Cancelar</button>
            <button class="btn-save" @click="doTransfer">Abrir painel 📁</button>
          </div>
        </div>
      </div>

      <!-- Modal de conexão -->
      <div v-if="connectTarget" class="form-overlay" @click.self="connectTarget = null">
        <div class="form">
          <h4>Conectar — {{ connectTarget.name }}</h4>
          <div class="row">
            <label>Host</label>
            <input :value="`${connectTarget.username}@${connectTarget.host}:${connectTarget.port}`" disabled />
          </div>
          <template v-if="connectTarget.authType === 'password'">
            <div class="row">
              <label>Senha</label>
              <input v-model="connectPassword" type="password" placeholder="Digite a senha" autofocus @keydown.enter="doConnect" />
            </div>
          </template>
          <template v-else>
            <div class="row">
              <label>Chave privada</label>
              <input :value="connectTarget.keyPath || '~/.ssh/id_rsa'" disabled />
            </div>
            <div class="row">
              <label>Passphrase</label>
              <input v-model="connectPassword" type="password" placeholder="Digite a passphrase" autofocus @keydown.enter="doConnect" />
            </div>
          </template>
          <div class="form-actions">
            <button @click="connectTarget = null">Cancelar</button>
            <button class="btn-save" @click="doConnect">Conectar ▶</button>
          </div>
        </div>
      </div>

      <!-- Formulário de criação/edição -->
      <div v-if="showForm" class="form-overlay" @click.self="showForm = false">
        <div class="form">
          <h4>{{ editingId ? 'Editar' : 'Novo' }} perfil remoto</h4>

          <div class="row">
            <label>Protocolo</label>
            <select v-model="form.protocol" @change="onProtocolChange">
              <option value="ssh">SSH (terminal + SFTP)</option>
              <option value="ftp">FTP (somente arquivos)</option>
            </select>
          </div>

          <div class="row">
            <label>Nome</label>
            <input v-model="form.name" placeholder="Ex: Servidor Produção" />
          </div>
          <div class="row">
            <label>Pasta (opcional)</label>
            <input v-model="form.folder" placeholder="Ex: Produção, Clientes, Dev" list="folder-list" />
            <datalist id="folder-list">
              <option v-for="f in folders" :key="f" :value="f" />
            </datalist>
          </div>
          <div class="row two-col">
            <div>
              <label>Host</label>
              <input v-model="form.host" placeholder="192.168.1.1" />
            </div>
            <div style="width: 80px">
              <label>Porta</label>
              <input v-model.number="form.port" type="number" />
            </div>
          </div>
          <div class="row">
            <label>Usuário</label>
            <input v-model="form.username" placeholder="root" />
          </div>
          <div class="row">
            <label>Autenticação</label>
            <select v-model="form.authType">
              <option value="password">Senha</option>
              <option value="privatekey">Chave privada</option>
            </select>
          </div>
          <div v-if="form.authType === 'password'" class="row">
            <label>Senha <small>(salva apenas nesta sessão)</small></label>
            <input v-model="form.password" type="password" autocomplete="off" />
          </div>
          <template v-else>
            <div class="row">
              <label>Caminho da chave</label>
              <div class="file-row">
                <input v-model="form.keyPath" placeholder="~/.ssh/id_rsa" />
                <button @click="pickKey">...</button>
              </div>
            </div>
            <div class="row check-row">
              <label class="check-label">
                <input v-model="form.hasPassphrase" type="checkbox" />
                Esta chave possui passphrase
              </label>
              <small class="hint">Se desmarcado, conecta direto sem pedir senha</small>
            </div>
          </template>
          <div class="row">
            <label>Tags</label>
            <input v-model="tagsInput" placeholder="produção, web" />
          </div>
          <div class="row">
            <label>Cor</label>
            <div class="colors">
              <span
                v-for="c in COLORS"
                :key="c"
                class="color-dot"
                :style="{ background: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }"
                @click="form.color = c"
              />
              <span
                class="color-dot clear"
                :style="{ outline: !form.color ? '2px solid #666' : 'none', outlineOffset: '2px' }"
                @click="form.color = ''"
                title="Sem cor"
              >✕</span>
            </div>
          </div>
          <div class="form-actions">
            <button @click="showForm = false">Cancelar</button>
            <button class="btn-save" @click="save">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, defineComponent, h } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { useTerminalsStore } from '@/stores/terminals'
import { useWorkspacesStore } from '@/stores/workspaces'
import { useFileTransferStore } from '@/stores/file-transfer'
import { storeToRefs } from 'pinia'
import type { SshProfile } from '@/types'

const emit = defineEmits<{ close: [] }>()

const sshStore  = useSshProfilesStore()
const termStore = useTerminalsStore()
const wsStore   = useWorkspacesStore()
const transferStore = useFileTransferStore()
const { profiles } = storeToRefs(sshStore)

const COLORS = ['#58a6ff', '#3fb950', '#ff7b72', '#d29922', '#bc8cff', '#76e3ea', '#f97316', '#ff6b6b', '#39d353']

// ── Folder grouping ───────────────────────────────────────

const collapsedFolders = ref<Set<string>>(new Set())

const folders = computed(() => {
  const set = new Set<string>()
  profiles.value.forEach((p) => { if (p.folder) set.add(p.folder) })
  return [...set].sort()
})

const profilesByFolder = computed(() => {
  const map: Record<string, SshProfile[]> = {}
  profiles.value.forEach((p) => {
    if (p.folder) {
      if (!map[p.folder]) map[p.folder] = []
      map[p.folder].push(p)
    }
  })
  return map
})

const unfoldered = computed(() => profiles.value.filter((p) => !p.folder))

function toggleFolder(folder: string) {
  if (collapsedFolders.value.has(folder)) {
    collapsedFolders.value.delete(folder)
  } else {
    collapsedFolders.value.add(folder)
  }
  collapsedFolders.value = new Set(collapsedFolders.value) // trigger reactivity
}

// ── Profile row inline component ─────────────────────────

const ProfileRow = defineComponent({
  props: { profile: { type: Object as () => SshProfile, required: true } },
  emits: ['connect', 'transfer', 'edit', 'remove'],
  setup(p, { emit }) {
    const isFtp = (p.profile.protocol ?? 'ssh') === 'ftp'
    return () =>
      h('div', { class: 'profile-inner' }, [
        h('div', { class: 'profile-info' }, [
          h('div', { class: 'profile-name' }, [
            isFtp ? h('span', { class: 'proto-tag ftp' }, 'FTP') : h('span', { class: 'proto-tag sftp' }, 'SSH'),
            p.profile.name,
          ]),
        ]),
        h('div', { class: 'profile-actions' }, [
          !isFtp ? h('button', { title: 'Terminal SSH', onClick: () => emit('connect', p.profile) }, '▶') : null,
          h('button', { title: isFtp ? 'Abrir FTP' : 'Abrir SFTP', onClick: () => emit('transfer', p.profile) }, '📁'),
          h('button', { title: 'Editar',   onClick: () => emit('edit',    p.profile) }, '✎'),
          h('button', { title: 'Excluir',  class: 'danger', onClick: () => emit('remove', p.profile.id) }, '✕'),
        ]),
      ])
  },
})

// ── Form state ────────────────────────────────────────────

const showForm  = ref(false)
const editingId = ref<string | null>(null)
const tagsInput = ref('')

const connectTarget  = ref<SshProfile | null>(null)
const connectPassword = ref('')

const transferTarget   = ref<SshProfile | null>(null)
const transferPassword = ref('')

const BLANK_FORM = () => ({
  name: '', folder: '', host: '', port: 22,
  username: '', authType: 'password' as 'password' | 'privatekey',
  password: '', keyPath: '', hasPassphrase: false, color: COLORS[0],
  protocol: 'ssh' as 'ssh' | 'ftp',
})

const form = reactive(BLANK_FORM())

onMounted(() => sshStore.load())

function openForm(profile?: SshProfile) {
  editingId.value = profile?.id ?? null
  Object.assign(form, BLANK_FORM())
  if (profile) {
    Object.assign(form, {
      name: profile.name, folder: profile.folder ?? '',
      host: profile.host, port: profile.port,
      username: profile.username, authType: profile.authType,
      keyPath: profile.keyPath ?? '', hasPassphrase: !!profile.hasPassphrase,
      color: profile.color ?? COLORS[0],
      protocol: profile.protocol ?? 'ssh',
    })
    tagsInput.value = profile.tags.join(', ')
  } else {
    tagsInput.value = ''
  }
  showForm.value = true
}

async function pickKey() {
  const selected = await openDialog({ multiple: false })
  if (typeof selected === 'string') form.keyPath = selected
}

async function save() {
  const tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean)
  const data: Omit<SshProfile, 'id'> = {
    name: form.name, folder: form.folder || undefined,
    host: form.host, port: form.port, username: form.username,
    authType: form.authType, keyPath: form.keyPath || undefined,
    hasPassphrase: form.authType === 'privatekey' ? form.hasPassphrase : undefined,
    tags, color: form.color || undefined,
    protocol: form.protocol,
  }
  if (editingId.value) {
    await sshStore.update(editingId.value, data)
  } else {
    await sshStore.create(data)
  }
  showForm.value = false
}

async function remove(id: string) {
  if (confirm('Excluir este perfil?')) await sshStore.remove(id)
}

function needsCredentialPrompt(profile: SshProfile): boolean {
  if ((profile.protocol ?? 'ssh') === 'ftp') return true
  if (profile.authType === 'password') return true
  return !!profile.hasPassphrase
}

function connect(profile: SshProfile) {
  if ((profile.protocol ?? 'ssh') === 'ftp') {
    openTransfer(profile)
    return
  }
  if (!needsCredentialPrompt(profile)) {
    connectTarget.value = profile
    connectPassword.value = ''
    void doConnect()
    return
  }
  connectPassword.value = ''
  connectTarget.value = profile
}

function openTransfer(profile: SshProfile) {
  if (profile.authType === 'privatekey' && !profile.hasPassphrase) {
    transferTarget.value = profile
    transferPassword.value = ''
    void doTransfer()
    return
  }
  transferPassword.value = ''
  transferTarget.value = profile
}

async function doTransfer() {
  const profile = transferTarget.value
  if (!profile) return
  transferTarget.value = null
  emit('close')
  try {
    if ((profile.protocol ?? 'ssh') === 'ftp') {
      await transferStore.openFtpProfile({
        host: profile.host, port: profile.port,
        username: profile.username,
        password: transferPassword.value,
        name: profile.name,
      })
    } else {
      await transferStore.openSftpProfile({
        host: profile.host, port: profile.port,
        username: profile.username,
        password: transferPassword.value,
        keyPath: profile.authType === 'privatekey' ? (profile.keyPath ?? '~/.ssh/id_rsa') : undefined,
        name: profile.name,
      })
    }
  } catch (err) {
    alert(`Erro ao abrir transferência:\n${err}`)
  }
}

function onProtocolChange() {
  form.port = form.protocol === 'ftp' ? 21 : 22
  if (form.protocol === 'ftp') form.authType = 'password'
}

async function doConnect() {
  const profile = connectTarget.value
  if (!profile) return
  connectTarget.value = null
  emit('close')
  try {
    const id = await termStore.openSsh({
      id: crypto.randomUUID(),
      host: profile.host, port: profile.port,
      username: profile.username,
      password: connectPassword.value,
      keyPath: profile.authType === 'privatekey' ? (profile.keyPath ?? '~/.ssh/id_rsa') : '',
      name: profile.name, color: profile.color, profileId: profile.id,
    })
    wsStore.placeTerminal(id)
    wsStore.autoExpand()
  } catch (err) {
    alert(`Erro ao iniciar conexão SSH:\n${err}`)
  }
}
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: #00000066; z-index: 50;
  display: flex; justify-content: flex-end;
}
.panel {
  width: 400px; height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-default);
  display: flex; flex-direction: column; overflow: hidden;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; border-bottom: 1px solid var(--border-subtle);
}
.panel-header h3 { font-size: 15px; color: var(--text-primary); }
.btn-close {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px;
}
.btn-close:hover { background: var(--bg-overlay); color: var(--accent-red); }

.profiles {
  flex: 1; overflow-y: auto; padding: 8px;
  display: flex; flex-direction: column; gap: 4px;
}

/* Folder */
.folder-group { display: flex; flex-direction: column; gap: 3px; }
.folder-header {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; font-size: 11px;
  color: var(--text-muted); cursor: pointer;
  border-radius: 5px; user-select: none;
  text-transform: uppercase; letter-spacing: 0.6px;
}
.folder-header:hover { background: var(--bg-overlay); color: var(--text-secondary); }
.folder-count {
  margin-left: auto; background: var(--bg-overlay);
  font-size: 10px; padding: 0 5px; border-radius: 8px;
}

.profile-card {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent-blue);
  border-radius: 7px; overflow: hidden;
}
.profile-card.indented { margin-left: 12px; }

.profile-inner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px;
}
.profile-info { flex: 1; min-width: 0; }
.profile-name { font-size: 13px; color: var(--text-primary); font-weight: 500; display: flex; align-items: center; gap: 6px; }
.proto-tag { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; }
.proto-tag.sftp { background: #1f3d2a; color: #3fb950; }
.proto-tag.ftp  { background: #3d2f1f; color: #d29922; }
.profile-actions { display: flex; gap: 4px; flex-shrink: 0; }
.profile-actions button {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 13px;
}
.profile-actions button:hover { background: var(--bg-overlay); color: var(--text-primary); }
.profile-actions .danger:hover { color: var(--accent-red); }

.empty-profiles { color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px; }

.btn-new {
  margin: 8px; padding: 8px;
  background: none; border: 1px dashed var(--border-default);
  color: var(--text-muted); cursor: pointer; border-radius: 6px; font-size: 13px;
}
.btn-new:hover { border-color: var(--accent-blue); color: var(--accent-blue); }

/* Form */
.form-overlay {
  position: fixed; inset: 0; background: #00000077; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.form {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  border-radius: 12px; padding: 20px; width: 380px; max-width: 100%;
  max-height: calc(100vh - 48px);
  color: var(--text-primary); display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto;
}
.form h4 { font-size: 14px; margin-bottom: 4px; }
.row { display: flex; flex-direction: column; gap: 4px; }
.row label { font-size: 11px; color: var(--text-muted); }
.row input, .row select {
  background: var(--bg-base); border: 1px solid var(--border-default);
  color: var(--text-primary); padding: 6px 10px; border-radius: 6px;
  font-size: 13px; outline: none;
}
.row input:focus, .row select:focus { border-color: var(--accent-blue); }
.check-row { gap: 2px; }
.check-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px !important; color: var(--text-primary) !important;
  cursor: pointer;
}
.check-label input { width: auto; margin: 0; }
.hint { font-size: 11px; color: var(--text-muted); }
.two-col { flex-direction: row; gap: 8px; align-items: flex-end; }
.two-col > div { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.file-row { display: flex; gap: 6px; }
.file-row input { flex: 1; }
.file-row button {
  background: var(--bg-overlay); border: 1px solid var(--border-default);
  color: var(--text-primary); padding: 6px 10px; border-radius: 6px; cursor: pointer;
}

.colors { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.color-dot {
  width: 20px; height: 20px; border-radius: 50%;
  cursor: pointer; transition: transform 0.15s;
}
.color-dot:hover { transform: scale(1.2); }
.color-dot.clear {
  background: var(--bg-overlay) !important;
  border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: var(--text-muted);
}

.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.form-actions button {
  padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;
  border: 1px solid var(--border-default); background: var(--bg-overlay); color: var(--text-primary);
}
.btn-save { background: var(--accent-green-dark) !important; border-color: var(--accent-green-hover) !important; color: #fff !important; }
.btn-save:hover { background: var(--accent-green-hover) !important; }
</style>
