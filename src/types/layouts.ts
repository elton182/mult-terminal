export interface LayoutPreset {
  id: string
  label: string
  columns: number[]
  shortcutNum: number
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'single',  label: '1',     columns: [1],       shortcutNum: 1 },
  { id: '1+1',     label: '1+1',   columns: [1, 1],    shortcutNum: 2 },
  { id: '2+1',     label: '2+1',   columns: [2, 1],    shortcutNum: 3 },
  { id: '1+2',     label: '1+2',   columns: [1, 2],    shortcutNum: 4 },
  { id: '2+3+1',   label: '2+3+1', columns: [2, 3, 1], shortcutNum: 5 },
  { id: '3+3',     label: '3+3',   columns: [3, 3],    shortcutNum: 6 },
]
