// What app code needs from a store. The encrypted store and the in-memory demo store both provide
// it, so screens don't know which one they're using.

export type StoredRecord = { id: string }

export interface RecordStore {
  readonly kind: 'encrypted' | 'memory'
  put<T extends StoredRecord>(collection: string, record: T): Promise<T>
  get<T extends StoredRecord>(collection: string, id: string): Promise<T | undefined>
  list<T extends StoredRecord>(collection: string): Promise<T[]>
  delete(collection: string, id: string): Promise<void>
  putBlob(data: Blob | Uint8Array<ArrayBuffer>): Promise<string>
  getBlob(id: string): Promise<Uint8Array<ArrayBuffer> | undefined>
  deleteBlob(id: string): Promise<void>
}
