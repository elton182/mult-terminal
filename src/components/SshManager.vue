<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel">
      <div class="panel-header">
        <h3>Perfis SSH</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="profiles">
        <div
          v-for="profile in profiles"
          :key="profile.id"
          class="profile-card"
          :style="profile.color ? { borderLeftColor: profile.color } : {}"
        >
          <div class="profile-info">
            <div class="profile-name">{{ profile.name }}</div>
            <div class="profile-host">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</div>
            <div class="tags">
              <span v-for="tag in profile.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="profile-actions">
            <button title="Conectar" @click="connect(profile)">▶</button>
            <button title="Editar" @click="openForm(profile)">✎</button>
            <button title="Excluir" class="danger" @click="remove(profile.id)">✕</button>
          </div>
        </div>

        <div v-if="profiles.length === 0" class="empty-profiles">
          Nenhum perfil SSH. Clique em "+ Novo" para adicionar.
        </div>
      </div>

      <button class="btn-new" @click="openForm()">+ Novo perfil</button>

      <!-- Modal de conexão (pede senha ou confirma chave) -->
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
              <input v-model="connectPassword" type="password" placeholder="Digite a senha" autofocus
                @keydown.enter="doConnect" />
            </div>
          </template>
          <template v-else>
            <div class="row">
              <label>Chave privada</label>
              <input :value="connectTarget.keyPath || '~/.ssh/id_rsa'" disabled />
            </div>
            <div class="row" v-if="needPassphrase">
              <label>Passphrase da chave (se houver)</label>
              <input v-model="connectPassword" type="password" placeholder="Deixe vazio se não tiver" @keydown.enter="doConnect" />
            </div>
          </template>
          <div class="form-actions">
            <button @click="connectTarget = null">Cancelar</button>
            <button class="btn-save" @click="doConnect">Conectar ▶</button>
          </div>
        </div>
      </div>

      <!-- Inline form -->
      <div v-if="showForm" class="form-overlay" @click.self="showForm = false">
        <div class="form">
          <h4>{{ editingId ? 'Editar' : 'Novo' }} perfil SSH</h4>

          <div class="row">
            <label>Nome</label>
            <input v-model="form.name" placeholder="Ex: Servidor Produção" />
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
          <div v-else class="row">
            <label>Caminho da chave</label>
            <div class="file-row">
              <input v-model="form.keyPath" placeholder="~/.ssh/id_rsa" />
              <button @click="pickKey">...</button>
            </div>
          </div>
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
import { ref, onMounted, reactive } from 'vue'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { useTerminalsStore } from '@/stores/terminals'
import { storeToRefs } from 'pinia'
import type { SshProfile } from '@/types'

const emit = defineEmits<{ close: [] }>()

const sshStore = useSshProfilesStore()
const termStore = useTerminalsStore()
const { profiles } = storeToRefs(sshStore)

const COLORS = ['#58a6ff', '#3fb950', '#ff7b72', '#d29922', '#bc8cff', '#76e3ea', '#f78166']

const showForm = ref(false)
const editingId = ref<string | null>(null)
const tagsInput = ref('')

// connect modal state
const connectTarget = ref<SshProfile | null>(null)
const connectPassword = ref('')
const needPassphrase = ref(false)

const BLANK_FORM = () => ({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password' as 'password' | 'privatekey',
  password: '',
  keyPath: '',
  color: COLORS[0],
})

const form = reactive(BLANK_FORM())

onMounted(() => sshStore.load())

function openForm(profile?: SshProfile) {
  editingId.value = profile?.id ?? null
  Object.assign(form, BLANK_FORM())
  if (profile) {
    Object.assign(form, {
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.authType,
      keyPath: profile.keyPath ?? '',
      color: profile.color ?? COLORS[0],
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
    name: form.name,
    host: form.host,
    port: form.port,
    username: form.username,
    authType: form.authType,
    keyPath: form.keyPath || undefined,
    tags,
    color: form.color,
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

function connect(profile: SshProfile) {
  connectPassword.value = ''
  needPassphrase.value = profile.authType === 'privatekey'
  connectTarget.value = profile
}

async function doConnect() {
  const profile = connectTarget.value
  if (!profile) return
  connectTarget.value = null

  emit('close')
  try {
    await termStore.openSsh({
      id: crypto.randomUUID(),
      host: profile.host,
      port: profile.port,
      username: profile.username,
      password: profile.authType === 'password' ? connectPassword.value : '',
      keyPath: profile.authType === 'privatekey' ? (profile.keyPath ?? '~/.ssh/id_rsa') : '',
      name: profile.name,
      color: profile.color,
      profileId: profile.id,
    })
  } catch (err) {
    alert(`Erro ao iniciar conexão SSH:\n${err}`)
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: #00000066;
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}

.panel {
  width: 380px;
  height: 100%;
  background: #161b22;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #21262d;
}

.panel-header h3 { font-size: 15px; color: #c9d1d9; }

.btn-close {
  background: none;
  border: none;
  color: #6e7681;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-close:hover { background: #21262d; color: #ff7b72; }

.profiles {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-left: 3px solid #58a6ff;
  border-radius: 8px;
}

.profile-name { font-size: 13px; color: #c9d1d9; font-weight: 500; }
.profile-host { font-size: 11px; color: #6e7681; margin-top: 2px; }

.tags { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.tag {
  font-size: 10px;
  padding: 1px 6px;
  background: #21262d;
  color: #8b949e;
  border-radius: 10px;
}

.profile-actions { display: flex; gap: 4px; }
.profile-actions button {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.profile-actions button:hover { background: #21262d; color: #c9d1d9; }
.profile-actions .danger:hover { color: #ff7b72; }

.empty-profiles {
  color: #6e7681;
  font-size: 13px;
  text-align: center;
  padding: 24px;
}

.btn-new {
  margin: 8px;
  padding: 8px;
  background: none;
  border: 1px dashed #30363d;
  color: #6e7681;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
}
.btn-new:hover { border-color: #58a6ff; color: #58a6ff; }

/* Form overlay (inside the panel) */
.form-overlay {
  position: fixed;
  inset: 0;
  background: #00000077;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 20px;
  width: 360px;
  color: #c9d1d9;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form h4 { font-size: 14px; margin-bottom: 4px; }

.row { display: flex; flex-direction: column; gap: 4px; }
.row label { font-size: 11px; color: #8b949e; }
.row input, .row select {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}
.row input:focus, .row select:focus { border-color: #58a6ff; }

.two-col { flex-direction: row; gap: 8px; align-items: flex-end; }
.two-col > div { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.file-row { display: flex; gap: 6px; }
.file-row input { flex: 1; }
.file-row button {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.colors { display: flex; gap: 8px; flex-wrap: wrap; }
.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}
.color-dot:hover { transform: scale(1.2); }

.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.form-actions button {
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  border: 1px solid #30363d;
  background: #21262d;
  color: #c9d1d9;
}
.btn-save { background: #238636 !important; border-color: #2ea043 !important; }
.btn-save:hover { background: #2ea043 !important; }
</style>
