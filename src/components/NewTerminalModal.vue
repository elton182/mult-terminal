<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="modal">
      <!-- Prompt de senha / passphrase -->
      <template v-if="authTarget">
        <h3>{{ authTarget.authType === 'password' ? 'Senha' : 'Passphrase' }}</h3>
        <p class="auth-hint">{{ authTarget.name }}</p>
        <div class="auth-form">
          <input
            v-model="authPassword"
            type="password"
            :placeholder="authTarget.authType === 'password' ? 'Digite a senha' : 'Digite a passphrase'"
            autofocus
            @keydown.enter="confirmAuth"
          />
          <div class="actions">
            <button @click="authTarget = null">Voltar</button>
            <button class="btn-primary" @click="confirmAuth">Conectar</button>
          </div>
        </div>
      </template>

      <!-- Lista de shells / perfis -->
      <template v-else>
        <h3>Novo Terminal</h3>

        <div class="modal-body">
          <div class="section-label">Shell local</div>
          <div class="shells">
            <button
              v-for="shell in shells"
              :key="shell"
              class="shell-btn"
              @click="emit('confirm', { type: shell })"
            >
              <span class="shell-icon">{{ shellIcon(shell) }}</span>
              <span>{{ shellTitle(shell) }}</span>
            </button>
          </div>

          <template v-if="sshOnly.length > 0">
            <div class="section-label" style="margin-top: 16px">SSH</div>
            <div class="shells">
              <button
                v-for="profile in sshOnly"
                :key="profile.id"
                class="shell-btn ssh-btn"
                :style="{ borderColor: profile.color }"
                @click="onSelectSsh(profile)"
              >
                <span class="shell-icon">🔒</span>
                <span>{{ profile.name }}</span>
              </button>
            </div>
          </template>
        </div>

        <div class="actions">
          <button @click="emit('cancel')">Cancelar</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { storeToRefs } from 'pinia'
import type { SshProfile } from '@/types'

const emit = defineEmits<{
  confirm: [opts: { type: string; profileId?: string; password?: string }]
  cancel: []
}>()

const shells = ref<string[]>([])
const sshStore = useSshProfilesStore()
const { profiles: sshProfiles } = storeToRefs(sshStore)

const authTarget = ref<SshProfile | null>(null)
const authPassword = ref('')

const sshOnly = computed(() =>
  sshProfiles.value.filter((p) => (p.protocol ?? 'ssh') === 'ssh'),
)

onMounted(async () => {
  shells.value = await invoke<string[]>('get_available_shells')
  await sshStore.load()
})

function onSelectSsh(profile: SshProfile) {
  if (profile.authType === 'password') {
    authTarget.value = profile
    authPassword.value = ''
    return
  }
  if (profile.authType === 'privatekey' && profile.hasPassphrase) {
    authTarget.value = profile
    authPassword.value = ''
    return
  }
  emit('confirm', { type: 'ssh', profileId: profile.id, password: '' })
}

function confirmAuth() {
  const profile = authTarget.value
  if (!profile) return
  emit('confirm', {
    type: 'ssh',
    profileId: profile.id,
    password: authPassword.value,
  })
}

const ICONS: Record<string, string> = {
  cmd: '⊞', powershell: '💠', bash: '$', wsl: '🐧', zsh: '%', fish: '🐟',
}
const TITLES: Record<string, string> = {
  cmd: 'Command Prompt', powershell: 'PowerShell', bash: 'Bash',
  wsl: 'WSL', zsh: 'Zsh', fish: 'Fish',
}

function shellIcon(s: string) { return ICONS[s] ?? '>' }
function shellTitle(s: string) { return TITLES[s] ?? s }
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: #00000088;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 24px;
  min-width: 340px;
  max-width: 480px;
  width: 100%;
  max-height: calc(100vh - 48px);
  color: #c9d1d9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

h3 { font-size: 16px; margin-bottom: 16px; flex-shrink: 0; }

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.auth-hint {
  font-size: 12px;
  color: #6e7681;
  margin: -8px 0 16px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.auth-form input {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}
.auth-form input:focus { border-color: #58a6ff; }

.section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6e7681;
  margin-bottom: 8px;
}

.shells {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shell-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 8px;
  color: #c9d1d9;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.shell-btn:hover { border-color: #58a6ff; background: #161b22; }

.ssh-btn { border-color: #30363d; }

.shell-icon { font-size: 16px; width: 20px; text-align: center; }

.actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.actions button {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}
.actions button:hover { border-color: #58a6ff; }
.btn-primary {
  background: #238636 !important;
  border-color: #2ea043 !important;
  color: #fff !important;
}
.btn-primary:hover { background: #2ea043 !important; }
</style>
