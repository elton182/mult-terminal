export interface TerminalInfo {
  id: string
  shell_type: string
  title: string
  pid?: number
}

export interface TerminalState {
  id: string
  title: string
  label?: string        // user-set label (shown instead of title in tabs/header)
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
  folder?: string
  protocol?: 'ssh' | 'ftp'   // default: ssh
}

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
}

export interface TransferProgress {
  bytes_done: number
  bytes_total: number
  direction: 'upload' | 'download'
  file_name: string
}

export interface TransferPanelState {
  visible: boolean
  sessionId: string | null
  protocol: 'sftp' | 'ftp'
  title: string
  loading: boolean
  error: string | null
  progress: TransferProgress | null
}

export interface WorkspaceTab {
  id: string
  label: string
  columns: number[]
  slots: (string | null)[]   // terminal IDs; null = empty slot
  activeTerminalId?: string
}

export type LayoutMode = 'vertical' | 'horizontal' | 'grid'
