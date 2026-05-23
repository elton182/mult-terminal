<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Configurações</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="section">
        <div class="section-title">Sistema</div>

        <div class="setting-row">
          <div>
            <div class="setting-name">Atalho no Desktop</div>
            <div class="setting-desc">Cria um atalho em {{ desktopLabel }}</div>
          </div>
          <button class="btn-action" :disabled="creating" @click="createShortcut">
            {{ creating ? 'Criando...' : 'Criar atalho' }}
          </button>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-name">Iniciar com o Windows</div>
            <div class="setting-desc">Abre o multerm ao fazer login</div>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="autoStart" @change="toggleAutoStart" />
            <span class="slider" />
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Atalhos de teclado</div>
        <table class="shortcuts">
          <tr v-for="s in SHORTCUTS" :key="s.keys">
            <td><kbd>{{ s.keys }}</kbd></td>
            <td>{{ s.description }}</td>
          </tr>
        </table>
      </div>

      <div v-if="message" class="message" :class="messageType">{{ message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { SHORTCUTS } from '@/composables/useKeyboard'

const emit = defineEmits<{ close: [] }>()

const desktopLabel = ref('Desktop')
const creating = ref(false)
const autoStart = ref(false)
const message = ref('')
const messageType = ref<'ok' | 'err'>('ok')

onMounted(async () => {
  autoStart.value = await invoke<boolean>('get_auto_startup').catch(() => false)
})

async function createShortcut() {
  creating.value = true
  try {
    await invoke('create_desktop_shortcut')
    showMsg('Atalho criado no Desktop!', 'ok')
  } catch (e) {
    showMsg(`Erro: ${e}`, 'err')
  } finally {
    creating.value = false
  }
}

async function toggleAutoStart() {
  try {
    await invoke('set_auto_startup', { enable: autoStart.value })
    showMsg(autoStart.value ? 'Auto-start ativado.' : 'Auto-start desativado.', 'ok')
  } catch (e) {
    autoStart.value = !autoStart.value
    showMsg(`Erro: ${e}`, 'err')
  }
}

function showMsg(msg: string, type: 'ok' | 'err') {
  message.value = msg
  messageType.value = type
  setTimeout(() => (message.value = ''), 4000)
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: #00000077;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 0;
  width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  color: #c9d1d9;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #21262d;
  position: sticky;
  top: 0;
  background: #161b22;
  z-index: 1;
}
.modal-header h3 { font-size: 15px; }

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

.section { padding: 16px 20px; border-bottom: 1px solid #21262d; }
.section:last-child { border-bottom: none; }

.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6e7681;
  margin-bottom: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 16px;
}
.setting-name { font-size: 13px; }
.setting-desc { font-size: 11px; color: #6e7681; margin-top: 2px; }

.btn-action {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-action:hover { border-color: #58a6ff; }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toggle switch */
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  inset: 0;
  background: #21262d;
  border-radius: 22px;
  border: 1px solid #30363d;
  cursor: pointer;
  transition: 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background: #6e7681;
  border-radius: 50%;
  transition: 0.2s;
}
.toggle input:checked + .slider { background: #238636; border-color: #2ea043; }
.toggle input:checked + .slider::before { transform: translateX(18px); background: #fff; }

/* Shortcuts table */
.shortcuts { width: 100%; border-collapse: collapse; font-size: 12px; }
.shortcuts tr + tr td { border-top: 1px solid #21262d22; }
.shortcuts td { padding: 5px 4px; }
.shortcuts td:first-child { width: 160px; }

kbd {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
}

.message {
  margin: 8px 20px 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}
.message.ok { background: #23863622; color: #3fb950; border: 1px solid #23863644; }
.message.err { background: #ff7b7222; color: #ff7b72; border: 1px solid #ff7b7244; }
</style>
