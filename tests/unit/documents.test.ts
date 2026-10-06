import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../src/core'
import { addDocument, deleteDocument, documentBytes, DocumentError, listDocuments, sniffType } from '../../src/core/documents/documents'

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(20).fill(0)])

describe('documents', () => {
  it('recognises files by their contents, not their names', () => {
    expect(sniffType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf')
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
    expect(sniffType(new TextEncoder().encode('<html><script>'))).toBeUndefined()
  })

  it('stores, lists, reads and deletes', async () => {
    const store = new MemoryStore()
    const pdf = new Blob([bytes(0x25, 0x50, 0x44, 0x46, 0x2d)], { type: 'text/plain' })
    const doc = await addDocument(store, pdf, { profileId: 'p1', date: '2026-09-01', kind: 'growth-report', title: 'Check-up' })
    expect(doc.mimeType).toBe('application/pdf')
    expect(await listDocuments(store, 'p1')).toHaveLength(1)
    expect(await listDocuments(store, 'p2')).toHaveLength(0)
    expect((await documentBytes(store, doc)).length).toBe(25)
    await deleteDocument(store, doc)
    expect(await listDocuments(store)).toHaveLength(0)
    expect(await store.getBlob(doc.blobId)).toBeUndefined()
  })

  it('refuses unknown and empty files', async () => {
    const store = new MemoryStore()
    await expect(addDocument(store, new Blob(['hello world, not a pdf']), { profileId: 'p', date: '2026-01-01', kind: 'x', title: 'x' })).rejects.toBeInstanceOf(DocumentError)
    await expect(addDocument(store, new Blob([]), { profileId: 'p', date: '2026-01-01', kind: 'x', title: 'x' })).rejects.toThrow('empty')
  })
})
