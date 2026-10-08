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

export const dbName = (appId: string) => `${appId}-vault`

export async function openTrailsDb(appId: string): Promise<Db> {
  const db: Db = await openDB<TrailsDb>(dbName(appId), 1, {
    upgrade(db) {
      db.createObjectStore('meta', { keyPath: 'id' })
      const records = db.createObjectStore('records', { keyPath: 'key' })
      records.createIndex('collection', 'collection')
      db.createObjectStore('blobs', { keyPath: 'id' })
    },
    // Another tab is erasing the vault (or a newer version is upgrading it): step aside, so it
    // isn't blocked. That tab then tells this one to start again (vault/channel.ts).
    blocking() {
      db.close()
    },
  })
  return db
}
