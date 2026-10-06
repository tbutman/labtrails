// Settings live in the encrypted 'settings' collection: one record for the core's settings and one
// for the app's own. Missing fields fall back to defaults, so new settings need no migration.

import type { EncryptedStore } from '../store/store'

export type Theme = 'system' | 'light' | 'dark'

export type CoreSettings = {
  theme: Theme
  autoLockMinutes: number
  ai: { provider: 'anthropic'; model: string; apiKey?: string }
  lastBackupAt?: string
  backupNudgeDismissedAt?: string
  // Changes since the last backup, for reminders. Apps decide what counts.
  changesSinceBackup: number
}

export const DEFAULT_CORE_SETTINGS: CoreSettings = {
  theme: 'system',
  autoLockMinutes: 5,
  ai: { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  changesSinceBackup: 0,
}

export async function loadCoreSettings(store: EncryptedStore): Promise<CoreSettings> {
  const saved = await store.get<{ id: string; value: Partial<CoreSettings> }>('settings', 'core')
  return { ...DEFAULT_CORE_SETTINGS, ...saved?.value, ai: { ...DEFAULT_CORE_SETTINGS.ai, ...saved?.value.ai } }
}

export async function saveCoreSettings(store: EncryptedStore, value: CoreSettings): Promise<void> {
  await store.put('settings', { id: 'core', value })
}

export async function loadAppSettings<T extends object>(store: EncryptedStore, defaults: T): Promise<T> {
  const saved = await store.get<{ id: string; value: Partial<T> }>('settings', 'app')
  return { ...defaults, ...saved?.value }
}

export async function saveAppSettings<T extends object>(store: EncryptedStore, value: T): Promise<void> {
  await store.put('settings', { id: 'app', value })
}
