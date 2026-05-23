import { ref } from 'vue'

export const draggingId = ref<string | null>(null)
export const overTargetId = ref<string | null>(null)

let ghost: HTMLElement | null = null
let swapCallback: ((a: string, b: string) => void) | null = null

/** Encontra o data-terminal-id do painel em (x, y), ignorando o ghost */
function panelAt(x: number, y: number): string | null {
  if (ghost) ghost.style.visibility = 'hidden'
  const el = document.elementFromPoint(x, y)
  if (ghost) ghost.style.visibility = ''
  return (
    el?.closest<HTMLElement>('[data-terminal-id]')?.dataset.terminalId ?? null
  )
}

function onMove(e: PointerEvent) {
  if (ghost) {
    ghost.style.left = e.clientX + 14 + 'px'
    ghost.style.top  = e.clientY + 10 + 'px'
  }
  overTargetId.value = panelAt(e.clientX, e.clientY)
}

function onUp(e: PointerEvent) {
  const targetId = panelAt(e.clientX, e.clientY)
  const sourceId = draggingId.value

  // limpa estado antes de chamar swap (evita flicker)
  ghost?.remove()
  ghost = null
  draggingId.value = null
  overTargetId.value = null
  document.removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerup', onUp)

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
    pointerEvents: 'none',
    border:        '1px solid #58a6ff',
    userSelect:    'none',
    left:          e.clientX + 14 + 'px',
    top:           e.clientY + 10 + 'px',
  })
  document.body.appendChild(ghost)

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup',   onUp)
}
