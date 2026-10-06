import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openTrails, WrongPassphraseError } from '../../src/core'
import { exportBackup, readBackup, restoreBackup, BackupError } from '../../src/core/backup/backup'
import type { KdfParams } from '../../src/core/vault/crypto'

const fastArgon = (): KdfParams => ({ alg: 'argon2id', salt: crypto.getRandomValues(new Uint8Array(16)), memoryKiB: 64, iterations: 1, parallelism: 1 })
const PASS = 'correct horse battery staple'
let n = 0
// Two "devices" share an appId but use separate databases, so name them apart.
const device = (appId: string, collections = ['children', 'measurements']) =>
  openTrails({ appId, collections, kdf: fastArgon }).then(async (t) => {
    await t.db.clear('meta')
    await t.db.clear('records')
    await t.db.clear('blobs')
    return t
  })

describe('backup', () => {
  it('round-trips records, unknown collections and documents', async () => {
    const appId = `backup${n++}`
    const a = await device(appId, ['children', 'measurements', 'labs-only'])
    await a.vault.create(PASS)
    // A name with a space: base64 ciphertext can't contain one, so the check below can't match by
    // chance (a short name like "Alex" turns up in ~2 MB of random base64 about one run in eight).
    await a.store.put('children', { id: 'c1', name: 'Alex Example' })
    await a.store.put('measurements', { id: 'm1', childId: 'c1', weightKg: 7.9 })
    await a.store.put('labs-only', { id: 'x', note: 'a collection this app version may not know' })
    const blob = new Uint8Array(1500000).map((_, i) => i % 251)
    const blobId = await a.store.putBlob(blob)
    await a.store.put('documents', { id: 'd1', profileId: 'c1', blobId })
    const file = await exportBackup(a.db, appId)
    expect(await file.text()).not.toContain('Alex Example')

    // Restore over the same database, as on a new device after clearing.
    a.vault.lock()
    await a.db.clear('records')
    await a.db.clear('blobs')
    await restoreBackup(a.db, await readBackup(file, appId), PASS)
    await a.vault.unlock(PASS)
    expect(await a.store.get('children', 'c1')).toEqual({ id: 'c1', name: 'Alex Example' })
    expect(await a.store.list('measurements')).toEqual([{ id: 'm1', childId: 'c1', weightKg: 7.9 }])
    expect(await a.store.get('labs-only', 'x')).toBeDefined()
    const got = await a.store.getBlob(blobId)
    expect(got && Buffer.from(got).equals(Buffer.from(blob))).toBe(true)
  })

  it('needs the passphrase and changes nothing when it is wrong', async () => {
    const appId = `backup${n++}`
    const a = await device(appId)
    await a.vault.create(PASS)
    await a.store.put('children', { id: 'c1', name: 'Alex' })
    const file = await exportBackup(a.db, appId)
    await a.store.put('children', { id: 'c2', name: 'Sam' })
    await expect(restoreBackup(a.db, await readBackup(file, appId), 'not the right passphrase')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect((await a.store.list('children')).length).toBe(2)
  })

  it('rejects a damaged backup before touching the device', async () => {
    const appId = `backup${n++}`
    const a = await device(appId)
    await a.vault.create(PASS)
    await a.store.put('children', { id: 'c1', name: 'Alex' })
    const backup = await readBackup(await exportBackup(a.db, appId), appId)
    backup.records[0].sealed.ct[3] ^= 1
    await a.store.put('children', { id: 'c2', name: 'Sam' })
    await expect(restoreBackup(a.db, backup, PASS)).rejects.toBeInstanceOf(BackupError)
    expect((await a.store.list('children')).length).toBe(2)
  })

  it('rejects other files and other apps', async () => {
    await expect(readBackup(new Blob(['hello']), 'babytrails')).rejects.toBeInstanceOf(BackupError)
    const appId = `backup${n++}`
    const a = await device(appId)
    await a.vault.create(PASS)
    await expect(readBackup(await exportBackup(a.db, appId), 'labtrails')).rejects.toThrow('different app')
  })
})
