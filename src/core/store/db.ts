// The IndexedDB layout. Everything the app writes goes through the encrypted store; the only plain
// values here are the vault header (salt, KDF settings, wrapped key) and each row's collection and
// random ID.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { KdfParams, Sealed } from '../vault/crypto'

export const VAULT_FORMAT = 1

export type VaultHeader = {
  id: 'vault'
  format: number
  appId: string
  kdf: KdfParams
  wrappedKey: Sealed
  createdAt: string
}

export type RecordRow = { key: string; collection: string; id: string; sealed: Sealed }
export type BlobRow = { id: string; chunks: Sealed[]; bytes: number }

export interface TrailsDb extends DBSchema {
  meta: { key: string; value: VaultHeader }
  records: { key: string; value: RecordRow; indexes: { collection: string } }
  blobs: { key: string; value: BlobRow }
}

export type Db = IDBPDatabase<TrailsDb>

export function openTrailsDb(appId: string): Promise<Db> {
  return openDB<TrailsDb>(`${appId}-vault`, 1, {
    upgrade(db) {
      db.createObjectStore('meta', { keyPath: 'id' })
      const records = db.createObjectStore('records', { keyPath: 'key' })
      records.createIndex('collection', 'collection')
      db.createObjectStore('blobs', { keyPath: 'id' })
    },
  })
}
