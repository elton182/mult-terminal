<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Configurações</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <!-- Tema -->
      <div class="section">
        <div class="section-title">Aparência</div>
        <div class="theme-grid">
          <button
            v-for="t in THEMES"
            :key="t.id"
            class="theme-btn"
            :class="{ active: themeStore.theme === t.id }"
            @click="themeStore.set(t.id)"
          >
            <span class="theme-preview" :data-t="t.id" />
            <span class="theme-label">{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- Sistema -->
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

      <!-- Atalhos -->
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
import { useThemeStore, type Theme } from '@/stores/theme'

const emit = defineEmits<{ close: [] }>()

const themeStore = useThemeStore()

const THEMES: { id: Theme; label: string }[] = [
  { id: 'dark',           label: 'Dark' },
  { id: 'high-contrast',  label: 'Alto Contraste' },
]

const desktopLabel = ref('Desktop')
const creating     = ref(false)
const autoStart    = ref(false)
const message      = ref('')
const messageType  = ref<'ok' | 'err'>('ok')

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
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  z-index: 1;
}
.modal-header h3 { font-size: 15px; }

.btn-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-close:hover { background: var(--bg-overlay); color: var(--accent-red); }

.section { padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
.section:last-child { border-bottom: none; }

.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

/* ── Seletor de tema ───────────────────────────── */
.theme-grid {
  display: flex;
  gap: 10px;
}

.theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: var(--bg-overlay);
  border: 2px solid var(--border-subtle);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  transition: border-color 0.15s, color 0.15s;
}
.theme-btn:hover { border-color: var(--border-default); color: var(--text-primary); }
.theme-btn.active { border-color: var(--accent-blue); color: var(--accent-blue); }

/* Miniaturas de preview */
.theme-preview {
  display: block;
  width: 80px;
  height: 48px;
  border-radius: 4px;
  border: 1px solid var(--border-default);
}
.theme-preview[data-t="dark"] {
  background: linear-gradient(180deg, #010409 28%, #0d1117 28% 50%, #161b22 50%);
}
.theme-preview[data-t="high-contrast"] {
  background: linear-gradient(180deg, #000 28%, #0a0a0a 28% 50%, #141414 50%);
  border-color: #666;
}

/* ── Linhas de configuração ────────────────────── */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 16px;
}
.setting-name { font-size: 13px; }
.setting-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.btn-action {
  background: var(--bg-overlay);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-action:hover { border-color: var(--accent-blue); }
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toggle switch */
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  border-radius: 22px;
  border: 1px solid var(--border-default);
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
  background: var(--text-muted);
  border-radius: 50%;
  transition: 0.2s;
}
.toggle input:checked + .slider { background: var(--accent-green-dark); border-color: var(--accent-green-hover); }
.toggle input:checked + .slider::before { transform: translateX(18px); background: #fff; }

/* Shortcuts */
.shortcuts { width: 100%; border-collapse: collapse; font-size: 12px; }
.shortcuts tr + tr td { border-top: 1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent); }
.shortcuts td { padding: 5px 4px; color: var(--text-secondary); }
.shortcuts td:first-child { width: 160px; }

kbd {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
  color: var(--text-primary);
}

.message {
  margin: 8px 20px 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}
.message.ok  { background: color-mix(in srgb, var(--accent-green) 12%, transparent); color: var(--accent-green); border: 1px solid color-mix(in srgb, var(--accent-green) 30%, transparent); }
.message.err { background: var(--accent-red-bg); color: var(--accent-red); border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent); }
</style>
