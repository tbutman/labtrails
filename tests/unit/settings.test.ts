import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { openTrails } from '../../src/core'
import { loadAppSettings, loadCoreSettings, saveAppSettings, saveCoreSettings, DEFAULT_CORE_SETTINGS } from '../../src/core/settings/settings'
import { startAutoLock } from '../../src/core/vault/autoLock'
import type { KdfParams } from '../../src/core/vault/crypto'

const fastArgon = (): KdfParams => ({ alg: 'argon2id', salt: crypto.getRandomValues(new Uint8Array(16)), memoryKiB: 64, iterations: 1, parallelism: 1 })
let n = 0

describe('settings', () => {
  it('falls back to defaults and keeps app settings separate', async () => {
    const t = await openTrails({ appId: `settings${n++}`, collections: [], kdf: fastArgon })
    await t.vault.create('correct horse battery staple')
    expect(await loadCoreSettings(t.store)).toEqual(DEFAULT_CORE_SETTINGS)
    await saveCoreSettings(t.store, { ...DEFAULT_CORE_SETTINGS, autoLockMinutes: 10 })
    await saveAppSettings(t.store, { units: 'imperial' })
    expect((await loadCoreSettings(t.store)).autoLockMinutes).toBe(10)
    expect(await loadAppSettings(t.store, { units: 'metric', extra: 1 })).toEqual({ units: 'imperial', extra: 1 })
  })
})

describe('auto-lock', () => {
  it('locks after inactivity and when hidden too long', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const t = await openTrails({ appId: `settings${n++}`, collections: [], kdf: fastArgon })
    await t.vault.create('correct horse battery staple')
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' }) as unknown as Document
    const stop = startAutoLock(t.vault, 5, doc)
    vi.advanceTimersByTime(4 * 60_000)
    doc.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(4 * 60_000)
    expect(t.vault.isUnlocked).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(t.vault.isUnlocked).toBe(false)

    await t.vault.unlock('correct horse battery staple')
    Object.assign(doc, { visibilityState: 'hidden' })
    doc.dispatchEvent(new Event('visibilitychange'))
    vi.setSystemTime(Date.now() + 6 * 60_000)
    Object.assign(doc, { visibilityState: 'visible' })
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(t.vault.isUnlocked).toBe(false)
    stop()
    vi.useRealTimers()
  })
})
