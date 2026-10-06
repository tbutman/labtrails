// The data layer, until the shared core is copied in (SPEC.md section 5). RecordStore has the same
// shape as the core's encrypted store (put, get, list, delete by collection), so swapping the
// in-memory version for the real one changes this file only.

import type { Collection } from '../labs/types'

export interface RecordStore {
  put<T extends { id: string }>(collection: Collection, record: T): Promise<void>
  get<T>(collection: Collection, id: string): Promise<T | undefined>
  list<T>(collection: Collection): Promise<T[]>
  delete(collection: Collection, id: string): Promise<void>
}

/** A store that keeps records in memory only. Used for demo mode and tests. */
export function memoryStore(): RecordStore {
  const data = new Map<Collection, Map<string, unknown>>()
  const coll = (c: Collection) => {
    let m = data.get(c)
    if (!m) data.set(c, (m = new Map()))
    return m
  }
  // Records are copied in and out, as the encrypted store's serialisation would, so callers can't
  // change stored data by accident.
  const copy = <T>(v: T): T => structuredClone(v)
  return {
    async put(c, record) {
      coll(c).set(record.id, copy(record))
    },
    async get(c, id) {
      const v = coll(c).get(id)
      return v === undefined ? undefined : copy(v as never)
    },
    async list(c) {
      return [...coll(c).values()].map((v) => copy(v as never))
    },
    async delete(c, id) {
      coll(c).delete(id)
    },
  }
}
