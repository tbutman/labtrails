// The shared core's entry point. See README.md for the interface.

import { openTrailsDb } from './store/db'
import { EncryptedStore } from './store/store'
import { VaultChannel } from './vault/channel'
import { Vault, type VaultOptions } from './vault/vault'

export type TrailsOptions = Omit<VaultOptions, 'channel'> & {
  appId: string
  // The app's own collections, in addition to the core's ('documents', 'settings').
  collections: readonly string[]
}

export async function openTrails({ appId, collections, ...vaultOptions }: TrailsOptions) {
  const db = await openTrailsDb(appId)
  // Shared with the app's other tabs: lock, "something changed", and "erased".
  const channel = new VaultChannel(appId)
  const vault = new Vault(db, appId, { ...vaultOptions, channel })
  const store = new EncryptedStore(vault, db, collections, channel)
  // Another tab erased everything: this tab's data is gone too, so start again.
  channel.subscribe((message) => {
    if (message.type === 'erased' && typeof location !== 'undefined') location.reload()
  })
  return { db, vault, store, channel }
}

export type Trails = Awaited<ReturnType<typeof openTrails>>

export { Vault, WrongPassphraseError, VaultLockedError, VaultExistsError, WeakPassphraseError, MIN_PASSPHRASE_LENGTH } from './vault/vault'
export { EncryptedStore, UnknownCollectionError, CORE_COLLECTIONS } from './store/store'
export type { KdfParams } from './vault/crypto'
export { KdfUnavailableError } from './vault/crypto'
export { checkPassphrase, STRENGTH_HINTS, type PassphraseCheck, type PassphraseStrength } from './vault/passphrase'
export { VaultChannel, type VaultMessage } from './vault/channel'
export { eraseEverything, takeErasedNotice } from './vault/erase'
export { MemoryStore } from './store/memory'
export type { RecordStore, StoredRecord } from './store/types'
export { addDocument, deleteDocument, documentBytes, listDocuments, readDocumentFile, sniffType, DocumentError, SUPPORTED_TYPES, MAX_DOCUMENT_BYTES } from './documents/documents'
export type { DocumentRecord, SupportedType } from './documents/documents'
