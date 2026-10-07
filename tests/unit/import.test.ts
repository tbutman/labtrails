import 'fake-indexeddb/auto'
import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../src/core'
import { addDocument } from '../../src/core/documents/documents'
import { storedFingerprints } from '../../src/core/import/duplicates'
import { DEFAULT_LIMITS, intake, sha256 } from '../../src/core/import/intake'
import { counts, queueReducer, unitsFromFiles, type Unit } from '../../src/core/import/queue'

const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n${text}\n%%EOF`) as Uint8Array<ArrayBuffer>
const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n]) as Uint8Array<ArrayBuffer>
const file = (bytes: Uint8Array, name: string) => new File([bytes as Uint8Array<ArrayBuffer>], name)

describe('intake', () => {
  it('takes several files, by their real type, with fingerprints', async () => {
    const { files, skipped } = await intake([file(pdf('a'), 'a.pdf'), file(png(1), 'photo.jpg'), file(new TextEncoder().encode('hello'), 'notes.txt')])
    expect(files.map((f) => [f.name, f.mimeType])).toEqual([
      ['a.pdf', 'application/pdf'],
      ['photo.jpg', 'image/png'], // the name says JPEG; the bytes say PNG
    ])
    expect(files[0].sha256).toBe(await sha256(pdf('a')))
    expect(skipped).toEqual([{ name: 'notes.txt', reason: expect.stringContaining('Not a PDF or a photo') }])
  })

  it('opens zips in the browser, skipping folders, macOS metadata, hidden files and nested zips', async () => {
    const inner = zipSync({ 'x.pdf': pdf('x') })
    const zip = zipSync({
      'reports/2024.pdf': pdf('2024'),
      'reports/2025.pdf': pdf('2025'),
      '__MACOSX/reports/._2024.pdf': new Uint8Array([1, 2, 3]),
      'reports/.DS_Store': new Uint8Array([1]),
      'old.zip': inner,
    })
    const { files, skipped } = await intake([file(zip, 'labs.zip')])
    expect(files.map((f) => [f.zip, f.name])).toEqual([
      ['labs.zip', 'reports/2024.pdf'],
      ['labs.zip', 'reports/2025.pdf'],
    ])
    expect(skipped).toEqual([{ name: 'labs.zip › old.zip', reason: 'A zip inside a zip; unpack it first.' }])
  })

  it('marks identical files in one batch as repeats of the first', async () => {
    const { files } = await intake([file(pdf('same'), 'one.pdf'), file(pdf('same'), 'copy.pdf'), file(pdf('other'), 'two.pdf')])
    expect(files[1].sameAs).toBe(files[0].id)
    expect(files[2].sameAs).toBeUndefined()
  })

  it('caps files per batch, file size and unpacked size', async () => {
    const limits = { ...DEFAULT_LIMITS, maxFiles: 2, maxFileBytes: 64, maxUnpackedBytes: 100 }
    const many = await intake([file(pdf('1'), '1.pdf'), file(pdf('2'), '2.pdf'), file(pdf('3'), '3.pdf')], limits)
    expect(many.files).toHaveLength(2)
    expect(many.skipped[0].reason).toContain('More than 2 files')

    const big = await intake([file(pdf('x'.repeat(100)), 'big.pdf')], limits)
    expect(big.skipped[0].reason).toContain('Larger than')

    const bomb = zipSync({ 'a.pdf': pdf('a'.repeat(40)), 'b.pdf': pdf('b'.repeat(40)), 'c.pdf': pdf('c'.repeat(40)) })
    const unzipped = await intake([file(bomb, 'bomb.zip')], { ...limits, maxFiles: 10 })
    expect(unzipped.skipped.some((s) => s.reason.includes('more than the app can safely open'))).toBe(true)
  })

  it('reports a damaged zip instead of failing the batch', async () => {
    const broken = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9, 9])
    const { files, skipped } = await intake([file(broken, 'broken.zip'), file(pdf('ok'), 'ok.pdf')])
    expect(files.map((f) => f.name)).toEqual(['ok.pdf'])
    expect(skipped[0]).toEqual({ name: 'broken.zip', reason: expect.stringContaining("couldn't be opened") })
  })
})

describe('duplicates against the vault', () => {
  it('finds stored documents by fingerprint, and fingerprints older documents once', async () => {
    const store = new MemoryStore()
    const old = await addDocument(store, new Blob([pdf('stored')]), { profileId: 'p', date: '2025-01-01', kind: 'lab-report', title: 'Old report', meta: {} })
    const byHash = await storedFingerprints(store)
    const hash = await sha256(pdf('stored'))
    expect(byHash.get(hash)?.id).toBe(old.id)
    // the fingerprint was written back
    expect((await store.get<{ id: string; meta: { sha256: string } }>('documents', old.id))?.meta.sha256).toBe(hash)

    const { files } = await intake([file(pdf('stored'), 'again.pdf'), file(pdf('new'), 'new.pdf')])
    const units = unitsFromFiles(files, byHash)
    expect(units.map((u) => [u.status, u.duplicateOf?.title])).toEqual([
      ['duplicate', 'Old report'],
      ['ready', undefined],
    ])
  })
})

describe('the queue', () => {
  it('catches a file added twice in separate drops of the same import', async () => {
    const first = (await intake([file(pdf('same'), 'a.pdf')])).files
    const second = (await intake([file(pdf('same'), 'a copy.pdf')])).files
    const units = unitsFromFiles([...first, ...second], new Map())
    expect(units.map((u) => [u.status, u.duplicateOf?.title, u.duplicateOf?.inBatch])).toEqual([
      ['ready', undefined, undefined],
      ['duplicate', 'a.pdf', true],
    ])
  })

  const unit = (id: string, status: Unit<string>['status'] = 'ready'): Unit<string> => ({ id, status, storeOnly: false })

  it('moves a unit through reading, review and saving', () => {
    let q = [unit('a')]
    q = queueReducer(q, { type: 'reading', id: 'a' })
    q = queueReducer(q, { type: 'read', id: 'a', proposal: 'rows' })
    expect(q[0]).toMatchObject({ status: 'review', proposal: 'rows' })
    q = queueReducer(q, { type: 'saved', id: 'a', outcome: '3 results' })
    expect(q[0]).toMatchObject({ status: 'saved', outcome: '3 results' })
  })

  it('refuses moves that skip a step, so nothing is saved without being read and reviewed', () => {
    const q = [unit('a')]
    expect(queueReducer(q, { type: 'saved', id: 'a', outcome: 'x' })).toBe(q)
    expect(queueReducer(q, { type: 'read', id: 'a', proposal: 'x' })).toBe(q)
  })

  it('keeps duplicates out unless the user insists', () => {
    let q = [unit('a', 'duplicate')]
    expect(queueReducer(q, { type: 'reading', id: 'a' })).toBe(q)
    q = queueReducer(q, { type: 'import-anyway', id: 'a' })
    expect(q[0].status).toBe('ready')
  })

  it('retries failures, removes waiting units, and counts by status', () => {
    let q = [unit('a'), unit('b'), unit('c')]
    q = queueReducer(q, { type: 'reading', id: 'a' })
    q = queueReducer(q, { type: 'failed', id: 'a', error: 'busy' })
    q = queueReducer(q, { type: 'remove', id: 'b' })
    q = queueReducer(q, { type: 'store-only', id: 'c', value: true })
    expect(counts(q)).toMatchObject({ failed: 1, ready: 1 })
    expect(q.find((u) => u.id === 'c')?.storeOnly).toBe(true)
    q = queueReducer(q, { type: 'retry', id: 'a' })
    expect(q.find((u) => u.id === 'a')).toMatchObject({ status: 'ready', error: undefined })
  })

  it('takes a title and date for a file before it is stored, not after (BABY-20)', () => {
    let q = [unit('a')]
    q = queueReducer(q, { type: 'details', id: 'a', title: 'Check-up at 2 months', date: '2026-08-01' })
    expect(q[0]).toMatchObject({ title: 'Check-up at 2 months', date: '2026-08-01' })
    q = queueReducer(q, { type: 'reading', id: 'a' })
    expect(queueReducer(q, { type: 'details', id: 'a', title: 'Later' })).toBe(q)
  })
})

describe('document kinds (added in the core for BabyTrails)', () => {
  it('starts each file as the kind the app guesses, and lets the user change it', async () => {
    const { files } = await intake([file(pdf('a'), 'eco-20-weeks.pdf'), file(pdf('b'), 'boletim.pdf')])
    const units = unitsFromFiles<null>(files, new Map(), (f) => f.name.startsWith('eco'), (f) => (f.name.startsWith('eco') ? 'ultrasound' : 'booklet'))
    expect(units.map((u) => [u.kind, u.storeOnly])).toEqual([
      ['ultrasound', true],
      ['booklet', false],
    ])
    const next = queueReducer(units, { type: 'kind', id: units[1].id, kind: 'doctor-note', storeOnly: true })
    expect(next[1]).toMatchObject({ kind: 'doctor-note', storeOnly: true })
    // Not once it's being read.
    const reading = queueReducer(next, { type: 'reading', id: units[0].id })
    expect(queueReducer(reading, { type: 'kind', id: units[0].id, kind: 'booklet', storeOnly: false })).toBe(reading)
  })
})
