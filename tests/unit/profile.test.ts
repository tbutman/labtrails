import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../src/core'
import { addDocument } from '../../src/core/documents/documents'
import { deleteProfile, loadProfile, seedDemo } from '../../src/data/profile'
import { DEMO_PROFILE } from '../../src/app/demo'

describe('deleting a person (LAB-08)', () => {
  it('deletes them and everything kept about them, and nobody else', async () => {
    const store = new MemoryStore()
    await seedDemo(store)
    const other = { id: 'other', name: 'Jane Doe', createdAt: '2026-01-01T00:00:00Z' }
    await store.put('profiles', other)
    await store.put('reports', { id: 'jr', profileId: 'other', date: '2026-01-01', source: 'manual', createdAt: '', updatedAt: '' })
    await store.put('askThreads', { id: 'a1', profileId: DEMO_PROFILE.id, turns: [], createdAt: '', updatedAt: '' })
    await store.put('lines', { id: 'l1', profileId: DEMO_PROFILE.id, markerId: 'ldl', label: 'x', high: 3, unit: 'mmol/L', createdAt: '', updatedAt: '' })
    const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: 'application/pdf' })
    const doc = await addDocument(store, pdf, { profileId: DEMO_PROFILE.id, date: '2026-06-09', kind: 'lab-report', title: 'Report' })

    await deleteProfile(store, DEMO_PROFILE.id)

    expect(await loadProfile(store, DEMO_PROFILE.id)).toBeNull()
    for (const c of ['reports', 'results', 'summaries', 'askThreads', 'timeline', 'lines', 'documents'] as const) {
      expect((await store.list<{ id: string; profileId: string }>(c)).filter((x) => x.profileId === DEMO_PROFILE.id), c).toEqual([])
    }
    expect(await store.getBlob(doc.blobId)).toBeFalsy()
    expect((await loadProfile(store, 'other'))?.reports).toHaveLength(1)
  })
})
