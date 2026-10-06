// The import queue's state, as a pure reducer so the rules are testable: one unit per document to
// create, its status, and the moves allowed between statuses. The UI (ImportWizard) only dispatches.

import type { IntakeFile } from './intake'
import type { StoredDoc } from './duplicates'

export type UnitStatus =
  | 'ready' // will be read (or stored, if storeOnly)
  | 'duplicate' // the same file is already in the vault or earlier in this batch; skipped unless the user insists
  | 'reading'
  | 'review' // read; waiting for the user to check it
  | 'saved'
  | 'stored' // kept without reading
  | 'skipped' // the user chose not to save it (the file stays, not read)
  | 'failed'

export type Unit<P> = {
  id: string
  /** A new file from this import, or a document already in the vault (from "Not read yet"). For pages
   * of one document, the first page. */
  file?: IntakeFile
  document?: StoredDoc
  /** Pages of one document (request 17), in order: the files, and once stored, their documents. */
  pages?: IntakeFile[]
  pageDocuments?: StoredDoc[]
  status: UnitStatus
  storeOnly: boolean
  /** The document kind it will be stored as, when the app offers a choice (adapter.kinds). */
  kind?: string
  duplicateOf?: { title: string; date?: string; inBatch?: boolean }
  error?: string
  proposal?: P
  /** What saving created, in words ("12 results on 15 Sep 2026"). */
  outcome?: string
}

export type Action<P> =
  | { type: 'remove'; id: string }
  | { type: 'store-only'; id: string; value: boolean }
  | { type: 'kind'; id: string; kind: string; storeOnly: boolean }
  | { type: 'import-anyway'; id: string }
  | { type: 'stored-document'; id: string; document: StoredDoc }
  | { type: 'reading'; id: string }
  | { type: 'read'; id: string; proposal: P }
  | { type: 'failed'; id: string; error: string }
  | { type: 'retry'; id: string }
  | { type: 'saved'; id: string; outcome: string }
  | { type: 'stored'; id: string }
  | { type: 'skipped'; id: string }
  | { type: 'add'; units: Unit<P>[] }
  | { type: 'group'; ids: string[] }
  | { type: 'ungroup'; id: string }
  | { type: 'move-page'; id: string; from: number; to: number }
  | { type: 'stored-pages'; id: string; documents: StoredDoc[] }

export function unitsFromFiles<P>(
  files: IntakeFile[],
  stored: Map<string, StoredDoc>,
  storeOnly: (f: IntakeFile) => boolean = () => false,
  kindFor?: (f: IntakeFile) => string,
): Unit<P>[] {
  return files.map((file, i) => {
    const existing = stored.get(file.sha256)
    // An identical file earlier in the list (this drop or an earlier one in the same import).
    const earlier = files.slice(0, i).find((f) => f.sha256 === file.sha256)
    const duplicateOf = existing ? { title: existing.title, date: existing.date } : earlier ? { title: earlier.name, inBatch: true } : undefined
    return {
      id: file.id,
      file,
      status: duplicateOf ? 'duplicate' : 'ready',
      storeOnly: storeOnly(file),
      ...(kindFor ? { kind: kindFor(file) } : {}),
      ...(duplicateOf ? { duplicateOf } : {}),
    }
  })
}

export function unitsFromDocuments<P>(documents: StoredDoc[]): Unit<P>[] {
  const units: Unit<P>[] = []
  const groups = new Map<string, StoredDoc[]>()
  for (const document of documents) {
    if (document.group) {
      const pages = groups.get(document.group.id)
      if (pages) {
        pages.push(document)
        continue
      }
      groups.set(document.group.id, [document])
    }
    units.push({ id: document.id, document, status: 'ready', storeOnly: false, kind: document.kind })
  }
  // Pages of one document come back as one unit, in page order.
  return units.map((u) => {
    const pages = u.document?.group && groups.get(u.document.group.id)
    if (!pages || pages.length < 2) return u
    const ordered = [...pages].sort((a, b) => a.group!.page - b.group!.page)
    return { ...u, id: ordered[0].id, document: ordered[0], pageDocuments: ordered }
  })
}

/** Photos that can become pages of one document: images, ready to read, not yet stored. */
export const canBePage = (u: Unit<unknown>) => u.status === 'ready' && !u.storeOnly && !!u.file && u.file.mimeType !== 'application/pdf' && !u.pages && !u.document

const MOVES: Record<Action<unknown>['type'], UnitStatus[]> = {
  remove: ['ready', 'duplicate', 'failed'],
  'store-only': ['ready'],
  kind: ['ready', 'duplicate'],
  'import-anyway': ['duplicate'],
  'stored-document': ['ready', 'reading', 'failed'],
  reading: ['ready'],
  read: ['reading'],
  failed: ['ready', 'reading'],
  retry: ['failed'],
  saved: ['review'],
  stored: ['ready'],
  skipped: ['review', 'failed'],
  add: [],
  group: [],
  ungroup: ['ready'],
  'move-page': ['ready'],
  'stored-pages': ['ready', 'reading', 'failed'],
}

export function queueReducer<P>(units: Unit<P>[], action: Action<P>): Unit<P>[] {
  if (action.type === 'add') {
    const ids = new Set(units.map((u) => u.id))
    return [...units, ...action.units.filter((u) => !ids.has(u.id))]
  }
  if (action.type === 'group') {
    // Photos, in the order given, become the pages of the first one's unit.
    const picked = action.ids.map((id) => units.find((u) => u.id === id)).filter((u): u is Unit<P> => !!u && canBePage(u))
    if (picked.length < 2 || picked.length !== action.ids.length) return units
    const merged: Unit<P> = { ...picked[0], file: picked[0].file, pages: picked.map((u) => u.file!) }
    const drop = new Set(picked.slice(1).map((u) => u.id))
    return units.filter((u) => !drop.has(u.id)).map((u) => (u.id === merged.id ? merged : u))
  }
  const unit = units.find((u) => u.id === action.id)
  if (!unit || !MOVES[action.type].includes(unit.status)) return units
  if (action.type === 'remove') return units.filter((u) => u.id !== action.id)
  const update = (patch: Partial<Unit<P>>) => units.map((u) => (u.id === action.id ? { ...u, ...patch } : u))
  switch (action.type) {
    case 'store-only':
      return update({ storeOnly: action.value })
    case 'kind':
      return update({ kind: action.kind, storeOnly: action.storeOnly })
    case 'import-anyway':
      return update({ status: 'ready', duplicateOf: undefined })
    case 'stored-document':
      return update({ document: action.document })
    case 'reading':
      return update({ status: 'reading', error: undefined })
    case 'read':
      return update({ status: 'review', proposal: action.proposal })
    case 'failed':
      return update({ status: 'failed', error: action.error })
    case 'retry':
      return update({ status: 'ready', error: undefined })
    case 'saved':
      return update({ status: 'saved', outcome: action.outcome })
    case 'stored':
      return update({ status: 'stored' })
    case 'skipped':
      return update({ status: 'skipped' })
    case 'ungroup': {
      if (!unit.pages || unit.document) return units
      // Each page becomes its own unit again, with its file's id (unique, unlike the group's after a reorder).
      const split = unit.pages.map((file): Unit<P> => ({ ...unit, id: file.id, file, pages: undefined }))
      return units.flatMap((u) => (u.id === unit.id ? split : [u]))
    }
    case 'move-page': {
      if (!unit.pages || unit.document) return units
      const { from, to } = action
      if (from < 0 || to < 0 || from >= unit.pages.length || to >= unit.pages.length) return units
      const pages = [...unit.pages]
      const [moved] = pages.splice(from, 1)
      pages.splice(to, 0, moved)
      return update({ pages, file: pages[0] })
    }
    case 'stored-pages':
      return update({ document: action.documents[0], pageDocuments: action.documents })
  }
}

export function counts<P>(units: Unit<P>[]): Record<UnitStatus, number> {
  const c = { ready: 0, duplicate: 0, reading: 0, review: 0, saved: 0, stored: 0, skipped: 0, failed: 0 } as Record<UnitStatus, number>
  for (const u of units) c[u.status]++
  return c
}

const fileName = (f: IntakeFile) => (f.zip ? `${f.zip} › ${f.name}` : f.name)
export const unitName = (u: Unit<unknown>) => (u.file ? fileName(u.file) : (u.document?.title ?? 'Document'))
/** How many pages a unit has (1 unless it's pages of one document). */
export const unitPages = (u: Unit<unknown>) => u.pages?.length ?? u.pageDocuments?.length ?? 1
export const unitBytes = (u: Unit<unknown>) =>
  u.pages ? u.pages.reduce((n, f) => n + f.bytes.length, 0) : u.pageDocuments ? u.pageDocuments.reduce((n, d) => n + d.bytes, 0) : (u.file?.bytes.length ?? u.document?.bytes ?? 0)
export const unitType = (u: Unit<unknown>) => u.file?.mimeType ?? u.document?.mimeType
