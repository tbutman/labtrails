// The shared core's entry point. See README.md for the interface.

import { openTrailsDb } from './store/db'
import { EncryptedStore } from './store/store'
import { Vault, type VaultOptions } from './vault/vault'

export type TrailsOptions = VaultOptions & {
  appId: string
  // The app's own collections, in addition to the core's ('documents', 'settings').
  collections: readonly string[]
}

export async function openTrails({ appId, collections, ...vaultOptions }: TrailsOptions) {
  const db = await openTrailsDb(appId)
  const vault = new Vault(db, appId, vaultOptions)
  const store = new EncryptedStore(vault, db, collections)
  return { db, vault, store }
}

export type Trails = Awaited<ReturnType<typeof openTrails>>

export { Vault, WrongPassphraseError, VaultLockedError, VaultExistsError, WeakPassphraseError, MIN_PASSPHRASE_LENGTH } from './vault/vault'
export { EncryptedStore, UnknownCollectionError, CORE_COLLECTIONS } from './store/store'
export type { KdfParams } from './vault/crypto'
export { MemoryStore } from './store/memory'
export type { RecordStore, StoredRecord } from './store/types'
export { addDocument, deleteDocument, documentBytes, listDocuments, readDocumentFile, sniffType, DocumentError, SUPPORTED_TYPES, MAX_DOCUMENT_BYTES } from './documents/documents'
export type { DocumentRecord, SupportedType } from './documents/documents'
