export interface TerminalInfo {
  id: string
  shell_type: string
  title: string
  pid?: number
}

export interface TerminalState {
  id: string
  title: string
  shellType: string
  color?: string
  isConnected: boolean
  type: 'local' | 'ssh'
  profileId?: string
}

export interface SshProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privatekey'
  keyPath?: string
  tags: string[]
  color?: string
}

export type LayoutMode = 'vertical' | 'horizontal' | 'grid'
