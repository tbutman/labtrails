import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openTrails, type VaultMessage } from '../../src/core'
import { eraseEverything } from '../../src/core/vault/erase'
import type { KdfParams } from '../../src/core/vault/crypto'

const fastArgon = (): KdfParams => ({ alg: 'argon2id', salt: crypto.getRandomValues(new Uint8Array(16)), memoryKiB: 64, iterations: 1, parallelism: 1 })
const PASS = 'quartz meadow tulip anchor'
const tab = (appId: string) => openTrails({ appId, collections: ['children'], kdf: fastArgon })
const until = async (done: () => boolean) => {
  for (let i = 0; i < 100 && !done(); i++) await new Promise((r) => setTimeout(r, 10))
}

describe('tabs share the lock and changes (CORE-09)', () => {
  it('locks every tab when one locks', async () => {
    const a = await tab('tabs-lock')
    const b = await tab('tabs-lock')
    await a.vault.create(PASS)
    await b.vault.unlock(PASS)
    a.vault.lock()
    await until(() => !b.vault.isUnlocked)
    expect(b.vault.isUnlocked).toBe(false)
  })

  it('tells the other tabs that something changed, once for a burst of writes, and never what', async () => {
    const a = await tab('tabs-changed')
    const b = await tab('tabs-changed')
    await a.vault.create(PASS)
    const heard: VaultMessage[] = []
    b.channel.subscribe((m) => heard.push(m))
    for (let i = 0; i < 5; i++) await a.store.put('children', { id: `c${i}`, name: 'Jane Doe' })
    await until(() => heard.length > 0)
    await new Promise((r) => setTimeout(r, 300))
    expect(heard).toEqual([{ type: 'changed' }])
  })
})

describe('erasing the vault (CORE-01)', () => {
  it('deletes the database, even with another tab open, and tells the other tabs', async () => {
    const a = await tab('tabs-erase')
    const b = await tab('tabs-erase')
    await a.vault.create(PASS)
    await a.store.put('children', { id: 'c', name: 'Jane Doe' })
    const heard: VaultMessage[] = []
    b.channel.subscribe((m) => heard.push(m))
    await eraseEverything({ appId: 'tabs-erase', db: a.db, channel: a.channel })
    await until(() => heard.length > 0)
    expect(heard).toEqual([{ type: 'erased' }])
    const fresh = await tab('tabs-erase')
    expect(await fresh.vault.exists()).toBe(false)
    expect(await fresh.db.count('records')).toBe(0)
  })
})
