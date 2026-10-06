// An in-memory store for demo mode: nothing is written to the device, and it's gone on reload.

import type { RecordStore, StoredRecord } from './types'

export class MemoryStore implements RecordStore {
  readonly kind = 'memory'
  #records = new Map<string, Map<string, unknown>>()
  #blobs = new Map<string, Uint8Array<ArrayBuffer>>()

  #collection(name: string) {
    let c = this.#records.get(name)
    if (!c) this.#records.set(name, (c = new Map()))
    return c
  }

  async put<T extends StoredRecord>(collection: string, record: T): Promise<T> {
    this.#collection(collection).set(record.id, structuredClone(record))
    return record
  }

  async get<T extends StoredRecord>(collection: string, id: string): Promise<T | undefined> {
    const value = this.#collection(collection).get(id)
    return value === undefined ? undefined : (structuredClone(value) as T)
  }

  async list<T extends StoredRecord>(collection: string): Promise<T[]> {
    return [...this.#collection(collection).values()].map((v) => structuredClone(v) as T)
  }

  async delete(collection: string, id: string): Promise<void> {
    this.#collection(collection).delete(id)
  }

  async putBlob(data: Blob | Uint8Array<ArrayBuffer>): Promise<string> {
    const id = crypto.randomUUID()
    this.#blobs.set(id, data instanceof Uint8Array ? data.slice() : new Uint8Array(await data.arrayBuffer()))
    return id
  }

  async getBlob(id: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
    return this.#blobs.get(id)?.slice()
  }

  async deleteBlob(id: string): Promise<void> {
    this.#blobs.delete(id)
  }
}
