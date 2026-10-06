// Pages of one document in the shared import (coordination request 17). Core only: no app code, so
// LabTrails can copy this file with the core.

import { describe, expect, it } from 'vitest'
import { pagesOf } from '../../src/core/documents/documents'
import type { StoredDoc } from '../../src/core/import/duplicates'
import type { IntakeFile } from '../../src/core/import/intake'
import { canBePage, queueReducer, unitBytes, unitName, unitPages, unitsFromDocuments, unitsFromFiles, type Unit } from '../../src/core/import/queue'

const photo = (id: string, type: IntakeFile['mimeType'] = 'image/jpeg'): IntakeFile => ({ id, name: `${id}.jpg`, bytes: new Uint8Array(10 + id.length) as Uint8Array<ArrayBuffer>, mimeType: type, sha256: `hash-${id}` })
const doc = (id: string, group?: StoredDoc['group']): StoredDoc =>
  ({ id, profileId: 'p', date: '2026-10-06', kind: 'report', title: `${id}.jpg`, mimeType: 'image/jpeg', bytes: 100, blobId: `b-${id}`, createdAt: '', meta: { importStatus: 'unread' }, ...(group ? { group } : {}) }) as StoredDoc

describe('pages of one document', () => {
  const queue = () => unitsFromFiles<string>([photo('a'), photo('b'), photo('c'), photo('d', 'application/pdf')], new Map())

  it('groups photos, in the order picked, into the first one’s unit', () => {
    const q = queueReducer(queue(), { type: 'group', ids: ['c', 'a'] })
    expect(q.map((u) => u.id)).toEqual(['b', 'c', 'd'])
    const grouped = q.find((u) => u.id === 'c')!
    expect(grouped.pages!.map((f) => f.id)).toEqual(['c', 'a'])
    expect(unitPages(grouped)).toBe(2)
    expect(unitName(grouped)).toBe('c.jpg')
    expect(unitBytes(grouped)).toBe(11 + 11)
  })

  it('only groups photos that are ready to read: not PDFs, not files kept without reading, not single picks', () => {
    const q = queue()
    expect(queueReducer(q, { type: 'group', ids: ['a', 'd'] })).toBe(q)
    expect(queueReducer(q, { type: 'group', ids: ['a'] })).toBe(q)
    const kept = queueReducer(q, { type: 'store-only', id: 'b', value: true })
    expect(queueReducer(kept, { type: 'group', ids: ['a', 'b'] })).toBe(kept)
    expect(q.filter(canBePage).map((u) => u.id)).toEqual(['a', 'b', 'c'])
  })

  it('reorders pages and separates them again', () => {
    let q = queueReducer(queue(), { type: 'group', ids: ['a', 'b', 'c'] })
    q = queueReducer(q, { type: 'move-page', id: 'a', from: 2, to: 0 })
    expect(q[0].pages!.map((f) => f.id)).toEqual(['c', 'a', 'b'])
    expect(q[0].file!.id).toBe('c')
    q = queueReducer(q, { type: 'ungroup', id: 'a' })
    // Each page is its own unit again, with its own file's id, so no two units share one.
    expect(q.map((u) => [u.id, u.file!.id, u.pages])).toEqual([
      ['c', 'c', undefined],
      ['a', 'a', undefined],
      ['b', 'b', undefined],
      ['d', 'd', undefined],
    ])
    expect(new Set(q.map((u) => u.id)).size).toBe(q.length)
  })

  it('keeps every page’s document once stored, and can’t be regrouped or reordered after that', () => {
    let q = queueReducer(queue(), { type: 'group', ids: ['a', 'b'] })
    q = queueReducer(q, { type: 'stored-pages', id: 'a', documents: [doc('x', { id: 'g', page: 1 }), doc('y', { id: 'g', page: 2 })] })
    expect(q[0].document!.id).toBe('x')
    expect(q[0].pageDocuments!.map((d) => d.id)).toEqual(['x', 'y'])
    expect(queueReducer(q, { type: 'move-page', id: 'a', from: 0, to: 1 })).toBe(q)
    expect(queueReducer(q, { type: 'ungroup', id: 'a' })).toBe(q)
  })

  it('brings stored pages back as one unit, in page order, for "Not read yet"', () => {
    const units = unitsFromDocuments<string>([doc('p2', { id: 'g', page: 2 }), doc('solo'), doc('p1', { id: 'g', page: 1 })])
    expect(units.map((u: Unit<string>) => [u.id, u.pageDocuments?.map((d) => d.id)])).toEqual([
      ['p1', ['p1', 'p2']],
      ['solo', undefined],
    ])
  })

  it('finds a document’s pages', () => {
    const all = [doc('p2', { id: 'g', page: 2 }), doc('solo'), doc('p1', { id: 'g', page: 1 })]
    expect(pagesOf(all[0], all).map((d) => d.id)).toEqual(['p1', 'p2'])
    expect(pagesOf(all[1], all).map((d) => d.id)).toEqual(['solo'])
  })
})
