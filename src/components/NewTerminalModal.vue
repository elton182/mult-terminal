<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="modal">
      <h3>Novo Terminal</h3>

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

      <template v-if="sshProfiles.length > 0">
        <div class="section-label" style="margin-top: 16px">SSH</div>
        <div class="shells">
          <button
            v-for="profile in sshProfiles"
            :key="profile.id"
            class="shell-btn ssh-btn"
            :style="{ borderColor: profile.color }"
            @click="emit('confirm', { type: 'ssh', profileId: profile.id })"
          >
            <span class="shell-icon">🔒</span>
            <div style="text-align: left">
              <div>{{ profile.name }}</div>
              <div style="font-size: 11px; opacity: 0.6">{{ profile.username }}@{{ profile.host }}</div>
            </div>
          </button>
        </div>
      </template>

      <div class="actions">
        <button @click="emit('cancel')">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSshProfilesStore } from '@/stores/ssh-profiles'
import { storeToRefs } from 'pinia'

const emit = defineEmits<{
  confirm: [opts: { type: string; profileId?: string }]
  cancel: []
}>()

const shells = ref<string[]>([])
const sshStore = useSshProfilesStore()
const { profiles: sshProfiles } = storeToRefs(sshStore)

onMounted(async () => {
  shells.value = await invoke<string[]>('get_available_shells')
  await sshStore.load()
})

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
}

.modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 24px;
  min-width: 340px;
  max-width: 480px;
  color: #c9d1d9;
}

h3 { font-size: 16px; margin-bottom: 16px; }

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
</style>
