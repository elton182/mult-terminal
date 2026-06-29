import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { FileEntry, TransferPanelState, TransferProgress } from '@/types'

let progressUnlisten: UnlistenFn | null = null

export const useFileTransferStore = defineStore('file-transfer', {
  state: (): TransferPanelState => ({
    visible: false,
    sessionId: null,
    protocol: 'sftp',
    title: '',
    loading: false,
    error: null,
    progress: null,
  }),

  actions: {
    async _bindProgress(sessionId: string) {
      await this._unbindProgress()
      progressUnlisten = await listen<TransferProgress>(
        `transfer-progress:${sessionId}`,
        (e) => { this.progress = e.payload },
      )
    },

    async _unbindProgress() {
      if (progressUnlisten) {
        progressUnlisten()
        progressUnlisten = null
      }
    },

    async openFromSshTerminal(terminalId: string, title: string) {
      const sessionId = crypto.randomUUID()
      this.loading = true
      this.error = null
      this.progress = null
      this.protocol = 'sftp'
      this.title = title
      this.sessionId = sessionId
      this.visible = true
      try {
        await invoke('transfer_sftp_from_ssh', { id: sessionId, sshTerminalId: terminalId })
        await this._bindProgress(sessionId)
      } catch (e) {
        this.error = String(e)
        this.sessionId = null
      } finally {
        this.loading = false
      }
    },

    async openSftpProfile(opts: {
      host: string
      port: number
      username: string
      password: string
      keyPath?: string
      name: string
    }) {
      const sessionId = crypto.randomUUID()
      this.loading = true
      this.error = null
      this.progress = null
      this.protocol = 'sftp'
      this.title = `${opts.name} (SFTP)`
      this.sessionId = sessionId
      this.visible = true
      try {
        await invoke('transfer_sftp_connect', {
          id: sessionId,
          host: opts.host,
          port: opts.port,
          username: opts.username,
          password: opts.password,
          keyPath: opts.keyPath ?? '',
          passphrase: opts.password,
        })
        await this._bindProgress(sessionId)
      } catch (e) {
        this.error = String(e)
        this.sessionId = null
      } finally {
        this.loading = false
      }
    },

    async openFtpProfile(opts: {
      host: string
      port: number
      username: string
      password: string
      name: string
    }) {
      const sessionId = crypto.randomUUID()
      this.loading = true
      this.error = null
      this.progress = null
      this.protocol = 'ftp'
      this.title = `${opts.name} (FTP)`
      this.sessionId = sessionId
      this.visible = true
      try {
        await invoke('transfer_ftp_connect', {
          id: sessionId,
          host: opts.host,
          port: opts.port,
          username: opts.username,
          password: opts.password,
        })
        await this._bindProgress(sessionId)
      } catch (e) {
        this.error = String(e)
        this.sessionId = null
      } finally {
        this.loading = false
      }
    },

    async close() {
      await this._unbindProgress()
      if (this.sessionId) {
        await invoke('transfer_disconnect', { id: this.sessionId }).catch(() => {})
      }
      this.visible = false
      this.sessionId = null
      this.error = null
      this.loading = false
      this.progress = null
    },

    async listRemote(path: string): Promise<FileEntry[]> {
      if (!this.sessionId) return []
      return invoke<FileEntry[]>('transfer_list_remote', { id: this.sessionId, path })
    },

    async listLocal(path: string): Promise<FileEntry[]> {
      return invoke<FileEntry[]>('transfer_list_local', { path })
    },

    async localHome(): Promise<string> {
      return invoke<string>('transfer_local_home')
    },

    async upload(localPath: string, remotePath: string) {
      if (!this.sessionId) return
      this.progress = null
      try {
        await invoke('transfer_upload', { id: this.sessionId, localPath, remotePath })
      } finally {
        setTimeout(() => { this.progress = null }, 400)
      }
    },

    async download(remotePath: string, localPath: string) {
      if (!this.sessionId) return
      this.progress = null
      try {
        await invoke('transfer_download', { id: this.sessionId, remotePath, localPath })
      } finally {
        setTimeout(() => { this.progress = null }, 400)
      }
    },

    async mkdirRemote(path: string) {
      if (!this.sessionId) return
      await invoke('transfer_mkdir_remote', { id: this.sessionId, path })
    },

    async deleteRemote(path: string, isDir: boolean) {
      if (!this.sessionId) return
      await invoke('transfer_delete_remote', { id: this.sessionId, path, isDir })
    },
  },
})
