import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { checkPassphrase, openTrails, WeakPassphraseError } from '../../src/core'
import type { KdfParams } from '../../src/core/vault/crypto'

const fastArgon = (): KdfParams => ({ alg: 'argon2id', salt: crypto.getRandomValues(new Uint8Array(16)), memoryKiB: 64, iterations: 1, parallelism: 1 })
let n = 0

describe('new passphrases (CORE-08)', () => {
  it('rejects the obvious', () => {
    expect(checkPassphrase('short words', 'BabyTrails').problem).toBe('Use at least 12 characters.')
    expect(checkPassphrase('aaaaaaaaaaaa', 'BabyTrails').problem).toBe('Use at least 4 different characters.')
    expect(checkPassphrase('abababababab', 'BabyTrails').problem).toBe('Use at least 4 different characters.')
    expect(checkPassphrase('monkey monkey monkey', 'BabyTrails').problem).toMatch(/Don't repeat one word/)
    expect(checkPassphrase('abcdabcdabcd', 'BabyTrails').problem).toMatch(/Don't repeat one word/)
    expect(checkPassphrase('BabyTrails2026', 'BabyTrails').problem).toMatch(/name BabyTrails/)
    expect(checkPassphrase('babytrails babytrails', 'BabyTrails').problem).toBeDefined()
  })

  it('accepts passphrases that get past those, with a three-step hint', () => {
    expect(checkPassphrase('quartz meadow tulip anchor', 'BabyTrails')).toEqual({ problem: undefined, strength: 'strong' })
    expect(checkPassphrase('my babytrails vault key', 'BabyTrails').problem).toBeUndefined()
    expect(checkPassphrase('river lantern', 'BabyTrails').strength).toBe('weak')
    expect(checkPassphrase('river lantern fig', 'BabyTrails').strength).toBe('ok')
    expect(checkPassphrase('Tr0ub4dor&3x!', 'BabyTrails').strength).toBe('weak')
  })

  it('is enforced by the vault too', async () => {
    const { vault } = await openTrails({ appId: `pass${n++}`, collections: [], kdf: fastArgon })
    await expect(vault.create('aaaaaaaaaaaa')).rejects.toBeInstanceOf(WeakPassphraseError)
    await vault.create('quartz meadow tulip anchor')
    await expect(vault.changePassphrase('quartz meadow tulip anchor', 'zzzzzzzzzzzzzz')).rejects.toThrow('Use at least 4 different characters.')
  })
})
