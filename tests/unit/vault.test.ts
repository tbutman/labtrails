import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openTrails, VaultLockedError, WrongPassphraseError, WeakPassphraseError, UnknownCollectionError } from '../../src/core'
import { newKdfParams, type KdfParams } from '../../src/core/vault/crypto'

// Tiny KDF settings keep the tests fast; one test below uses the real defaults.
const fastArgon = (): KdfParams => ({ alg: 'argon2id', salt: crypto.getRandomValues(new Uint8Array(16)), memoryKiB: 64, iterations: 1, parallelism: 1 })
const PASS = 'correct horse battery staple'

let n = 0
const fresh = (kdf: () => KdfParams = fastArgon) => openTrails({ appId: `test${n++}`, collections: ['children'], kdf })

describe('vault', () => {
  it('creates, locks and unlocks', async () => {
    const { vault, store } = await fresh()
    expect(await vault.exists()).toBe(false)
    await vault.create(PASS)
    expect(vault.isUnlocked).toBe(true)
    await store.put('children', { id: 'a', name: 'Alex' })
    vault.lock()
    expect(vault.isUnlocked).toBe(false)
    await expect(store.get('children', 'a')).rejects.toBeInstanceOf(VaultLockedError)
    await vault.unlock(PASS)
    expect(await store.get('children', 'a')).toEqual({ id: 'a', name: 'Alex' })
  })

  it('rejects a wrong passphrase without unlocking', async () => {
    const { vault } = await fresh()
    await vault.create(PASS)
    vault.lock()
    await expect(vault.unlock('correct horse battery stapler')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect(vault.isUnlocked).toBe(false)
  })

  it('refuses short passphrases', async () => {
    const { vault } = await fresh()
    await expect(vault.create('short')).rejects.toBeInstanceOf(WeakPassphraseError)
    expect(await vault.exists()).toBe(false)
  })

  it('works with PBKDF2 too', async () => {
    const { vault, store } = await fresh(() => ({ ...newKdfParams('pbkdf2-sha256'), iterations: 1000 }))
    await vault.create(PASS)
    await store.put('children', { id: 'a' })
    vault.lock()
    await expect(vault.unlock('wrong passphrase here')).rejects.toBeInstanceOf(WrongPassphraseError)
    await vault.unlock(PASS)
    expect(await store.list('children')).toEqual([{ id: 'a' }])
  })

  it('uses the OWASP Argon2id settings by default', async () => {
    const { vault } = await openTrails({ appId: `test${n++}`, collections: [] })
    await vault.create(PASS)
    const header = await vault.header()
    expect(header?.kdf).toMatchObject({ alg: 'argon2id', memoryKiB: 19456, iterations: 2, parallelism: 1 })
    expect(header?.kdf.salt).toHaveLength(16)
  })

  it('changes the passphrase without re-encrypting data', async () => {
    const { vault, store } = await fresh()
    await vault.create(PASS)
    await store.put('children', { id: 'a', name: 'Alex' })
    await vault.changePassphrase(PASS, 'a different long passphrase')
    vault.lock()
    await expect(vault.unlock(PASS)).rejects.toBeInstanceOf(WrongPassphraseError)
    await vault.unlock('a different long passphrase')
    expect(await store.get('children', 'a')).toEqual({ id: 'a', name: 'Alex' })
  })

  it('tells listeners when it locks and unlocks', async () => {
    const { vault } = await fresh()
    const seen: boolean[] = []
    vault.subscribe((u) => seen.push(u))
    await vault.create(PASS)
    vault.lock()
    vault.lock()
    expect(seen).toEqual([true, false])
  })
})

describe('encrypted store', () => {
  it('stores nothing readable in IndexedDB', async () => {
    const { vault, store, db } = await fresh()
    await vault.create(PASS)
    await store.put('children', { id: 'a', name: 'Alexandra Example' })
    const raw = JSON.stringify(await db.getAll('records'), (_k, v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v))
    expect(raw).not.toContain('Alexandra')
  })

  it('fails to decrypt a record moved to another ID', async () => {
    const { vault, store, db } = await fresh()
    await vault.create(PASS)
    await store.put('children', { id: 'a', name: 'Alex' })
    const row = (await db.get('records', 'children/a'))!
    await db.put('records', { ...row, key: 'children/b', id: 'b' })
    await expect(store.get('children', 'b')).rejects.toThrow()
  })

  it('fails to decrypt a tampered record', async () => {
    const { vault, store, db } = await fresh()
    await vault.create(PASS)
    await store.put('children', { id: 'a', name: 'Alex' })
    const row = (await db.get('records', 'children/a'))!
    row.sealed.ct[0] ^= 1
    await db.put('records', row)
    await expect(store.get('children', 'a')).rejects.toThrow()
  })

  it('rejects unregistered collections', async () => {
    const { vault, store } = await fresh()
    await vault.create(PASS)
    await expect(store.put('kids', { id: 'a' })).rejects.toBeInstanceOf(UnknownCollectionError)
  })

  it('round-trips blobs across chunk boundaries', async () => {
    const { vault, store } = await fresh()
    await vault.create(PASS)
    for (const size of [0, 1, 1024 * 1024, 1024 * 1024 + 7, 3 * 1024 * 1024]) {
      const bytes = new Uint8Array(size).map((_, i) => (i * 31) % 256)
      const id = await store.putBlob(bytes)
      const got = await store.getBlob(id)
      expect(got && Buffer.from(got).equals(Buffer.from(bytes))).toBe(true)
    }
  })

  it('fails on a truncated blob', async () => {
    const { vault, store, db } = await fresh()
    await vault.create(PASS)
    const id = await store.putBlob(new Uint8Array(2 * 1024 * 1024 + 1))
    const row = (await db.get('blobs', id))!
    await db.put('blobs', { ...row, chunks: row.chunks.slice(0, 2) })
    await expect(store.getBlob(id)).rejects.toThrow()
  })
})
