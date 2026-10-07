// The app's session: whether there's a vault, whether it's unlocked or the demo is running, and the
// store and settings that go with it.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MemoryStore, RecordStore, Trails } from '../core'
import { DEFAULT_CORE_SETTINGS, loadAppSettings, loadCoreSettings, saveAppSettings, saveCoreSettings, type CoreSettings } from '../core/settings/settings'
import { startAutoLock } from '../core/vault/autoLock'
import { seedDemo } from '../data/profile'
import { SessionContext, type Mode, type Notice, type Session } from './sessionContext'
import { APP_COLLECTIONS, APP_ID, DEFAULT_APP_SETTINGS, type AppSettings } from './types'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [trails, setTrails] = useState<Trails | null>(null)
  const [mode, setMode] = useState<Mode>('loading')
  const [demo, setDemo] = useState<MemoryStore | null>(null)
  const [core, setCore] = useState<CoreSettings>(DEFAULT_CORE_SETTINGS)
  const [app, setApp] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)

  const reload = useCallback(async () => {
    if (!trails) return
    setMode(!(await trails.vault.exists()) ? 'welcome' : trails.vault.isUnlocked ? 'unlocked' : 'locked')
  }, [trails])

  useEffect(() => {
    let live = true
    // The vault (and its key derivation, the largest part of it) loads after the first render, so the
    // landing page shows without waiting for it.
    void import('../core').then(async ({ openTrails }) => {
      const t = await openTrails({ appId: APP_ID, collections: APP_COLLECTIONS })
      const exists = await t.vault.exists()
      if (!live) return
      setTrails(t)
      setMode((m) => (m === 'demo' ? m : exists ? 'locked' : 'welcome'))
    })
    return () => {
      live = false
    }
  }, [])

  // Follow the vault: auto-lock and manual lock both land here, and drop decrypted settings.
  useEffect(() => {
    if (!trails) return
    return trails.vault.subscribe((unlocked) => {
      setMode((m) => (m === 'demo' ? m : unlocked ? 'unlocked' : 'locked'))
      if (!unlocked) {
        setCore(DEFAULT_CORE_SETTINGS)
        setApp(DEFAULT_APP_SETTINGS)
      }
    })
  }, [trails])

  useEffect(() => {
    if (mode !== 'unlocked' || !trails) return
    return startAutoLock(trails.vault, core.autoLockMinutes)
  }, [mode, trails, core.autoLockMinutes])

  // Another tab saved something: reload lists and settings here too (CORE-09). Lock and erase are
  // handled by the core's channel itself.
  useEffect(() => {
    if (!trails) return
    return trails.channel.subscribe((message) => {
      if (message.type !== 'changed' || !trails.vault.isUnlocked) return
      setVersion((v) => v + 1)
      void loadCoreSettings(trails.store).then(setCore)
      void loadAppSettings(trails.store, DEFAULT_APP_SETTINGS).then(setApp)
    })
  }, [trails])

  const loadSettings = useCallback(async (t: Trails) => {
    setCore(await loadCoreSettings(t.store))
    setApp(await loadAppSettings(t.store, DEFAULT_APP_SETTINGS))
  }, [])

  const value = useMemo<Session>(() => {
    const store: RecordStore | null = mode === 'demo' ? demo : mode === 'unlocked' && trails ? trails.store : null
    return {
      mode,
      trails,
      store,
      core,
      app,
      version,
      changed: () => setVersion((v) => v + 1),
      createVault: async (passphrase) => {
        if (!trails) return
        await trails.vault.create(passphrase)
        await loadSettings(trails)
        void navigator.storage?.persist?.()
      },
      unlock: async (passphrase) => {
        if (!trails) return
        await trails.vault.unlock(passphrase)
        await loadSettings(trails)
        setNotice(null)
      },
      lock: () => trails?.vault.lock(),
      startDemo: async () => {
        const { MemoryStore } = await import('../core')
        const store = new MemoryStore()
        await seedDemo(store)
        setDemo(store)
        setApp(DEFAULT_APP_SETTINGS)
        setMode('demo')
      },
      exitDemo: () => {
        setDemo(null)
        if (trails) void reload()
        else setMode('loading')
      },
      saveCore: async (next) => {
        if (mode === 'unlocked' && trails) await saveCoreSettings(trails.store, next)
        setCore(next)
      },
      saveApp: async (next) => {
        if (mode === 'unlocked' && trails) await saveAppSettings(trails.store, next)
        setApp(next)
      },
      reload,
      notice,
      setNotice,
    }
  }, [mode, trails, demo, core, app, version, notice, loadSettings, reload])

  useEffect(() => {
    if (core.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = core.theme
  }, [core.theme])

  return <SessionContext value={value}>{children}</SessionContext>
}
