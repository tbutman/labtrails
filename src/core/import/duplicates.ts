// Recognizing files that are already in the vault, by their SHA-256 fingerprint, before anything is
// sent to the AI (which also saves the cost of reading them again).

import type { RecordStore } from '../store/types'
import { documentBytes, type DocumentRecord } from '../documents/documents'
import { sha256 } from './intake'

/** What the import keeps in a document's `meta`, alongside the app's own fields. */
export type ImportMeta = {
  sha256?: string
  /** unread: stored, waiting to be read; read: its contents were saved; stored: kept without reading. */
  importStatus?: 'unread' | 'read' | 'stored'
}

export type StoredDoc = DocumentRecord<string, ImportMeta & Record<string, unknown>>

/**
 * Every stored document by fingerprint. Documents saved before fingerprints existed get one computed
 * from their (decrypted) bytes and written back, so this only happens once.
 */
export async function storedFingerprints(store: RecordStore): Promise<Map<string, StoredDoc>> {
  const docs = await store.list<StoredDoc>('documents')
  const byHash = new Map<string, StoredDoc>()
  for (const doc of docs) {
    let hash = doc.meta?.sha256
    if (!hash) {
      try {
        hash = await sha256(await documentBytes(store, doc))
        await store.put('documents', { ...doc, meta: { ...doc.meta, sha256: hash } })
      } catch {
        continue // a missing blob can't be fingerprinted; it can't be a duplicate either
      }
    }
    if (!byHash.has(hash)) byHash.set(hash, doc)
  }
  return byHash
}
