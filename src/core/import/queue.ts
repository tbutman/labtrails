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
  /** A new file from this import, or a document already in the vault (from "Not read yet"). */
  file?: IntakeFile
  document?: StoredDoc
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
  return documents.map((document) => ({ id: document.id, document, status: 'ready', storeOnly: false, kind: document.kind }))
}

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
}

export function queueReducer<P>(units: Unit<P>[], action: Action<P>): Unit<P>[] {
  if (action.type === 'add') {
    const ids = new Set(units.map((u) => u.id))
    return [...units, ...action.units.filter((u) => !ids.has(u.id))]
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
  }
}

export function counts<P>(units: Unit<P>[]): Record<UnitStatus, number> {
  const c = { ready: 0, duplicate: 0, reading: 0, review: 0, saved: 0, stored: 0, skipped: 0, failed: 0 } as Record<UnitStatus, number>
  for (const u of units) c[u.status]++
  return c
}

export const unitName = (u: Unit<unknown>) => (u.file ? (u.file.zip ? `${u.file.zip} › ${u.file.name}` : u.file.name) : (u.document?.title ?? 'Document'))
export const unitBytes = (u: Unit<unknown>) => u.file?.bytes.length ?? u.document?.bytes ?? 0
export const unitType = (u: Unit<unknown>) => u.file?.mimeType ?? u.document?.mimeType
