// The vault: creates, unlocks and locks the data key. Nothing else in the app sees the passphrase,
// and the data key only exists in memory, as a non-extractable CryptoKey, while unlocked.

import type { Db, VaultHeader } from '../store/db'
import { VAULT_FORMAT } from '../store/db'
import type { VaultChannel } from './channel'
import {
  bestKdfParams,
  deriveWrappingKey,
  generateDataKey,
  unwrapDataKey,
  wrapDataKey,
  type KdfParams,
} from './crypto'
import { checkPassphrase, MIN_PASSPHRASE_LENGTH } from './passphrase'

export { MIN_PASSPHRASE_LENGTH }

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase doesn't open this vault.")
    this.name = 'WrongPassphraseError'
  }
}

export class VaultLockedError extends Error {
  constructor() {
    super('The vault is locked.')
    this.name = 'VaultLockedError'
  }
}

export class VaultExistsError extends Error {
  constructor() {
    super('A vault already exists on this device.')
    this.name = 'VaultExistsError'
  }
}

export class WeakPassphraseError extends Error {
  constructor(message = `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`) {
    super(message)
    this.name = 'WeakPassphraseError'
  }
}

type Listener = (unlocked: boolean) => void

export type VaultOptions = {
  // Only tests pass this, to keep key derivation fast. Otherwise Argon2id, or PBKDF2 where
  // WebAssembly can't run.
  kdf?: () => KdfParams | Promise<KdfParams>
  // Tells the app's other tabs when this one locks (openTrails sets it up).
  channel?: VaultChannel
}

export class Vault {
  #key: CryptoKey | null = null
  #listeners = new Set<Listener>()
  readonly db: Db
  readonly appId: string
  readonly #newKdf: () => KdfParams | Promise<KdfParams>
  readonly #channel?: VaultChannel

  constructor(db: Db, appId: string, options: VaultOptions = {}) {
    this.db = db
    this.appId = appId
    this.#newKdf = options.kdf ?? bestKdfParams
    this.#channel = options.channel
    // Another tab locked (by hand, by auto-lock or before a restore): lock this one too.
    this.#channel?.subscribe((message) => {
      if (message.type === 'lock') this.#setKey(null)
    })
  }

  get #wrapAad() {
    return `${this.appId}/vault-key/v${VAULT_FORMAT}`
  }

  get isUnlocked() {
    return this.#key !== null
  }

  // The data key, for the store. Throws when locked, so nothing can read or write by accident.
  get key(): CryptoKey {
    if (!this.#key) throw new VaultLockedError()
    return this.#key
  }

  async exists(): Promise<boolean> {
    return (await this.db.get('meta', 'vault')) !== undefined
  }

  async header(): Promise<VaultHeader | undefined> {
    return this.db.get('meta', 'vault')
  }

  async create(passphrase: string): Promise<void> {
    this.#checkNew(passphrase)
    if (await this.exists()) throw new VaultExistsError()
    const kdf = await this.#newKdf()
    const dataKey = await generateDataKey()
    const wrappedKey = await wrapDataKey(dataKey, await deriveWrappingKey(passphrase, kdf), this.#wrapAad)
    await this.db.put('meta', {
      id: 'vault',
      format: VAULT_FORMAT,
      appId: this.appId,
      kdf,
      wrappedKey,
      createdAt: new Date().toISOString(),
    })
    // Keep only a non-extractable copy in memory.
    await this.unlock(passphrase)
  }

  async unlock(passphrase: string): Promise<void> {
    const header = await this.header()
    if (!header) throw new Error('There is no vault on this device yet.')
    this.#setKey(await this.#unwrap(header, passphrase, false))
  }

  // Locks this tab and the app's other tabs.
  lock(): void {
    this.#setKey(null)
    this.#channel?.post({ type: 'lock' })
  }

  // Re-wraps the same data key under a new passphrase. The data itself isn't re-encrypted. The new
  // wrapping uses the best key derivation this browser runs, so a PBKDF2 vault moves to Argon2id.
  async changePassphrase(current: string, next: string): Promise<void> {
    this.#checkNew(next)
    const header = await this.header()
    if (!header) throw new Error('There is no vault on this device yet.')
    const extractable = await this.#unwrap(header, current, true)
    const kdf = await this.#newKdf()
    const wrappedKey = await wrapDataKey(extractable, await deriveWrappingKey(next, kdf), this.#wrapAad)
    await this.db.put('meta', { ...header, kdf, wrappedKey })
    await this.unlock(next)
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #checkNew(passphrase: string) {
    const { problem } = checkPassphrase(passphrase, this.appId)
    if (problem) throw new WeakPassphraseError(problem)
  }

  async #unwrap(header: VaultHeader, passphrase: string, extractable: boolean): Promise<CryptoKey> {
    if (header.appId !== this.appId) throw new Error('This vault belongs to a different app.')
    if (header.format > VAULT_FORMAT) throw new Error('This vault was made by a newer version of the app.')
    const wrappingKey = await deriveWrappingKey(passphrase, header.kdf) // KdfUnavailableError without WebAssembly
    try {
      return await unwrapDataKey(header.wrappedKey, wrappingKey, this.#wrapAad, extractable)
    } catch {
      throw new WrongPassphraseError()
    }
  }

  #setKey(key: CryptoKey | null) {
    const changed = (key === null) !== (this.#key === null)
    this.#key = key
    if (changed) for (const listener of this.#listeners) listener(key !== null)
  }
}
