import { defineStore } from 'pinia'
import { Store } from '@tauri-apps/plugin-store'
import type { SshProfile } from '@/types'

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await Store.load('ssh-profiles.json')
  }
  return _store
}

export const useSshProfilesStore = defineStore('ssh-profiles', {
  state: () => ({
    profiles: [] as SshProfile[],
  }),

  actions: {
    async load() {
      const store = await getStore()
      const profiles = await store.get<SshProfile[]>('profiles')
      this.profiles = profiles ?? []
    },

    async create(profile: Omit<SshProfile, 'id'>): Promise<SshProfile> {
      const newProfile: SshProfile = {
        ...profile,
        id: crypto.randomUUID(),
      }
      this.profiles.push(newProfile)
      await this._persist()
      return newProfile
    },

    async update(id: string, updates: Partial<Omit<SshProfile, 'id'>>) {
      const idx = this.profiles.findIndex((p) => p.id === id)
      if (idx >= 0) {
        this.profiles[idx] = { ...this.profiles[idx], ...updates }
        await this._persist()
      }
    },

    async remove(id: string) {
      this.profiles = this.profiles.filter((p) => p.id !== id)
      await this._persist()
    },

    async _persist() {
      const store = await getStore()
      await store.set('profiles', this.profiles)
      await store.save()
    },
  },
})
