// Encrypted records and blobs. Apps register the collections they use; the core doesn't know what's
// in them. Each record is sealed with the data key and bound to its collection and ID, so a row
// copied into another slot fails to decrypt instead of showing the wrong data.

import { openJson, open, seal, sealJson } from '../vault/crypto'
import type { Vault } from '../vault/vault'
import type { BlobRow, Db } from './db'
import type { RecordStore, StoredRecord } from './types'

export const BLOB_CHUNK_BYTES = 1024 * 1024

// Collections the core itself uses. Apps add their own.
export const CORE_COLLECTIONS = ['documents', 'settings'] as const

export class UnknownCollectionError extends Error {
  constructor(collection: string) {
    super(`Unknown collection "${collection}". Register it when opening the store.`)
    this.name = 'UnknownCollectionError'
  }
}

export class EncryptedStore implements RecordStore {
  readonly kind = 'encrypted'
  readonly #vault: Vault
  readonly #db: Db
  readonly collections: ReadonlySet<string>

  constructor(vault: Vault, db: Db, appCollections: readonly string[]) {
    this.#vault = vault
    this.#db = db
    this.collections = new Set([...CORE_COLLECTIONS, ...appCollections])
  }

  #check(collection: string) {
    if (!this.collections.has(collection)) throw new UnknownCollectionError(collection)
  }

  #recordAad(collection: string, id: string) {
    return `${this.#vault.appId}/record/${collection}/${id}`
  }

  #blobAad(id: string, index: number, count: number) {
    return `${this.#vault.appId}/blob/${id}/${index}/${count}`
  }

  async put<T extends StoredRecord>(collection: string, record: T): Promise<T> {
    this.#check(collection)
    const sealed = await sealJson(this.#vault.key, record, this.#recordAad(collection, record.id))
    await this.#db.put('records', { key: `${collection}/${record.id}`, collection, id: record.id, sealed })
    return record
  }

  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | undefined> {
    this.#check(collection)
    const row = await this.#db.get('records', `${collection}/${id}`)
    if (!row) return undefined
    return openJson<T>(this.#vault.key, row.sealed, this.#recordAad(collection, id))
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    this.#check(collection)
    const key = this.#vault.key
    const rows = await this.#db.getAllFromIndex('records', 'collection', collection)
    return Promise.all(rows.map((row) => openJson<T>(key, row.sealed, this.#recordAad(collection, row.id))))
  }

  async delete(collection: string, id: string): Promise<void> {
    this.#check(collection)
    await this.#db.delete('records', `${collection}/${id}`)
  }

  // Stores bytes encrypted in 1 MiB chunks and returns the new blob's ID.
  async putBlob(data: Blob | Uint8Array<ArrayBuffer>): Promise<string> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer())
    const id = crypto.randomUUID()
    const count = Math.max(1, Math.ceil(bytes.length / BLOB_CHUNK_BYTES))
    const key = this.#vault.key
    const chunks = []
    for (let i = 0; i < count; i++) {
      const part = bytes.slice(i * BLOB_CHUNK_BYTES, (i + 1) * BLOB_CHUNK_BYTES)
      chunks.push(await seal(key, part, this.#blobAad(id, i, count)))
    }
    await this.#db.put('blobs', { id, chunks, bytes: bytes.length })
    return id
  }

  async getBlob(id: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
    const row: BlobRow | undefined = await this.#db.get('blobs', id)
    if (!row) return undefined
    const key = this.#vault.key
    const out = new Uint8Array(row.bytes)
    let offset = 0
    for (const [i, chunk] of row.chunks.entries()) {
      const part = await open(key, chunk, this.#blobAad(id, i, row.chunks.length))
      out.set(part, offset)
      offset += part.length
    }
    if (offset !== row.bytes) throw new Error('This file is damaged.')
    return out
  }

  async deleteBlob(id: string): Promise<void> {
    await this.#db.delete('blobs', id)
  }
}
