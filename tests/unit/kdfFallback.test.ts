// Its own file: hash-wasm keeps its WebAssembly once loaded, so nothing here may run Argon2id before
// WebAssembly is taken away.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KdfUnavailableError, openTrails } from '../../src/core'
import { argon2idAvailable, newKdfParams } from '../../src/core/vault/crypto'

const PASS = 'quartz meadow tulip anchor'

afterEach(() => vi.unstubAllGlobals())

describe('without WebAssembly (CORE-07)', () => {
  it('makes the vault with PBKDF2-SHA256, which still opens', async () => {
    vi.stubGlobal('WebAssembly', undefined)
    expect(await argon2idAvailable()).toBe(false)
    const { vault } = await openTrails({ appId: 'kdf-fallback', collections: [] })
    await vault.create(PASS)
    expect((await vault.header())?.kdf).toMatchObject({ alg: 'pbkdf2-sha256', iterations: 600_000 })
    vault.lock()
    await vault.unlock(PASS)
    expect(vault.isUnlocked).toBe(true)
  })

  it("says so when an Argon2id vault can't be opened here", async () => {
    const t = await openTrails({ appId: 'kdf-argon', collections: [], kdf: () => ({ ...(newKdfParams('argon2id') as Extract<ReturnType<typeof newKdfParams>, { alg: 'argon2id' }>), memoryKiB: 64, iterations: 1 }) })
    await t.vault.create(PASS)
    t.vault.lock()
    vi.stubGlobal('WebAssembly', undefined)
    await expect(t.vault.unlock(PASS)).rejects.toBeInstanceOf(KdfUnavailableError)
  })
})
