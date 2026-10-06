// The session's shape and the hooks screens use to read it; the provider is in session.tsx. Same shape
// as BabyTrails', so the two apps behave alike: one set of screens for the demo and the real vault.

import { createContext, useContext } from 'react'
import type { RecordStore, Trails } from '../core'
import type { CoreSettings } from '../core/settings/settings'
import type { AppSettings } from './types'

export type Mode = 'loading' | 'welcome' | 'locked' | 'unlocked' | 'demo'

export type Session = {
  mode: Mode
  trails: Trails | null
  store: RecordStore | null
  core: CoreSettings
  app: AppSettings
  /** Bumped after every write, so screens reload. */
  version: number
  changed: () => void
  createVault: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  startDemo: () => Promise<void>
  exitDemo: () => void
  saveCore: (next: CoreSettings) => Promise<void>
  saveApp: (next: AppSettings) => Promise<void>
  reload: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside SessionProvider')
  return session
}

export function useStore(): RecordStore {
  const { store } = useSession()
  if (!store) throw new Error('No store: the vault is locked')
  return store
}
