import { ref } from 'vue'

export const draggingId   = ref<string | null>(null)
export const overTargetId = ref<string | null>(null)

let ghost: HTMLElement | null = null
let swapCallback: ((a: string, b: string) => void) | null = null

/**
 * Encontra o data-terminal-id do painel em (x, y).
 * Oculta o ghost com display:none antes de chamar elementFromPoint —
 * pointer-events:none NÃO é respeitado pelo elementFromPoint no Chromium.
 */
function panelAt(x: number, y: number): string | null {
  if (ghost) ghost.style.display = 'none'
  const el = document.elementFromPoint(x, y)
  if (ghost) ghost.style.display = ''
  return (
    el?.closest<HTMLElement>('[data-terminal-id]')?.dataset.terminalId ?? null
  )
}

function onMove(e: PointerEvent) {
  if (ghost) {
    ghost.style.left = e.clientX + 14 + 'px'
    ghost.style.top  = e.clientY + 10 + 'px'
  }
  // Atualiza o alvo enquanto o cursor se move
  overTargetId.value = panelAt(e.clientX, e.clientY)
}

function onUp(e: PointerEvent) {
  // Usa overTargetId (rastreado durante o move) como fonte primária.
  // Fallback para panelAt caso o último pointermove não tenha disparado.
  const targetId = overTargetId.value ?? panelAt(e.clientX, e.clientY)
  const sourceId = draggingId.value

  // Limpa estado
  ghost?.remove()
  ghost = null
  draggingId.value   = null
  overTargetId.value = null
  document.removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerup',   onUp)

  if (targetId && sourceId && targetId !== sourceId && swapCallback) {
    swapCallback(sourceId, targetId)
  }
  swapCallback = null
}

export function startDrag(
  terminalId: string,
  label: string,
  e: PointerEvent,
  onSwap: (a: string, b: string) => void,
) {
  draggingId.value = terminalId
  swapCallback = onSwap

  ghost = document.createElement('div')
  ghost.textContent = '⠿ ' + label
  Object.assign(ghost.style, {
    position:      'fixed',
    zIndex:        '9999',
    background:    '#21262d',
    color:         '#c9d1d9',
    padding:       '3px 10px',
    borderRadius:  '6px',
    fontSize:      '12px',
    pointerEvents: 'none',   // não interfere em eventos reais
    border:        '1px solid #58a6ff',
    userSelect:    'none',
    left:          e.clientX + 14 + 'px',
    top:           e.clientY + 10 + 'px',
  })
  document.body.appendChild(ghost)

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup',   onUp)
}
