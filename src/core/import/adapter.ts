// What an app plugs into the shared import: how to read one document, what "already saved" means for
// it, and what saving creates. Everything else (intake, duplicates, the queue, consent, the review
// queue) is the same in every Trails app.

import type { ComponentType } from 'react'
import type { Column, ConfirmedRow, ProposedRow } from '../review/model'
import type { StoredDoc } from './duplicates'
import type { IntakeFile } from './intake'

export type ReadResult<M> = {
  rows: ProposedRow[]
  /** Facts about the whole document the app wants to keep (a lab name, a sample date). */
  meta: M
  /** Rows in the AI's answer that didn't pass validation and were left out. */
  dropped: number
}

export type CheckResult = {
  /** Rows that match records already saved; left out of the review and listed for the user. */
  alreadySaved: ProposedRow[]
  /** An existing record this document seems to repeat (a different file of the same report). */
  similar?: { label: string; detail: string }
}

export type DocumentKindOption = { value: string; label: string; read: boolean }

export type ImportAdapter<M> = {
  appName: string
  /** The `kind` given to stored documents. */
  documentKind: string
  /** "report", "reports"; used in headings and buttons. */
  noun: { one: string; many: string }
  /** The review panel's columns. */
  columns: Column[]
  /** Whether reading is possible now (an API key is set, or the demo has a prepared answer). */
  canRead: boolean
  /** Reads one stored document. Throw an Error with a message for the user to mark it failed. */
  read: (doc: StoredDoc, bytes: Uint8Array<ArrayBuffer>) => Promise<ReadResult<M>>
  /**
   * Optional: reads several photos as the pages of one document, together (request 17), so a table
   * that runs across pages comes back as one extraction; each row's `page` is its page number. With
   * it, the queue offers to group photos; without it, nothing changes.
   */
  readPages?: (pages: { doc: StoredDoc; bytes: Uint8Array<ArrayBuffer> }[]) => Promise<ReadResult<M>>
  /** Compares what was read with what's already saved. */
  check?: (result: ReadResult<M>) => Promise<CheckResult>
  /** Saves the confirmed rows; returns a short description of what was created. */
  save: (doc: StoredDoc, rows: ConfirmedRow[], meta: M) => Promise<string>
  /** An optional editor for the document-level facts, shown above the rows during review. */
  MetaEditor?: ComponentType<{ meta: M; onChange: (meta: M) => void }>
  /** What the send sheet says is left out, and any warnings. */
  sendSheet: { notSending: string[]; notes: string[] }
  /** A rough token estimate for reading, for the send sheet's cost line. */
  estimate: (files: { pdfs: number; images: number }) => { inputTokens: number; outputTokens: number }
  /** Files to keep without reading by default (BabyTrails: ultrasound images). */
  storeOnlyByDefault?: (file: IntakeFile) => boolean
  /**
   * Optional: the kinds of document the app stores, shown as a type picker on each file in the queue.
   * Files of a kind with `read: false` are kept without reading (BabyTrails: doctor's notes, which
   * are summarized from their own page, and ultrasound images, which are never read). Without
   * `kinds`, every file is stored as `documentKind`.
   */
  kinds?: DocumentKindOption[]
  /** The kind a new file starts as, e.g. guessed from its name. Defaults to `documentKind`. */
  kindFor?: (file: IntakeFile) => string
  /** Where the AI key is added, e.g. "/app/settings#ai", for the "add one in Settings" link. */
  settingsPath?: string
  /** For the demo: a made-up sample document to try the flow with. */
  sample?: { url: string; title: string }
}
