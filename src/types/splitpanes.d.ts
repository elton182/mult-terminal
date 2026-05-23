declare module 'splitpanes' {
  import type { DefineComponent } from 'vue'
  export const Splitpanes: DefineComponent<{
    horizontal?: boolean
    pushOtherPanes?: boolean
    dblClickSplitter?: boolean
  }>
  export const Pane: DefineComponent<{
    minSize?: number
    maxSize?: number
    size?: number
  }>
}
