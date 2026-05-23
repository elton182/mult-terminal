import { ref } from 'vue'

/** ID do terminal sendo arrastado no momento. Null = nenhum drag ativo. */
export const draggingTerminalId = ref<string | null>(null)
