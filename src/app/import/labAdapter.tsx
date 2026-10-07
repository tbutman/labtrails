// LabTrails' plug-in for the shared import (src/core/import): how a lab report is read, what counts
// as already saved, and what saving creates.

import type { RecordStore } from '../../core'
import { AiError, askJson, imageBlock, pdfBlock, shrinkImage, type ContentBlock } from '../../core/ai/client'
import { pagesOf } from '../../core/documents/documents'
import type { ConfirmedRow } from '../../core/review/model'
import { EXTRACTION_SYSTEM } from '../../labs/ai/prompts'
import { alreadySavedRows, parseFasting, similarReport } from '../../labs/extraction/duplicates'
import { extractionPrompt, printedDates, printedTime, recordsFromConfirmed, toProposedRows, type ConfirmedResultRow, type ProposedResultRow } from '../../labs/extraction/proposals'
import { EXTRACTION_SCHEMA, validateExtraction, type Extraction } from '../../labs/extraction/schema'
import type { Alias, Report, Result } from '../../labs/types'
import type { ImportAdapter } from '../../core/import/adapter'
import type { StoredDoc } from '../../core/import/duplicates'
import { DEMO_EXTRACTION } from '../demo'
import { EXTRACTION_COLUMNS } from '../extractionColumns'
import { formatDate, plural } from '../format'
import { LabMetaEditor } from './LabMetaEditor'

export type LabMeta = {
  lab: string
  fasting?: 'yes' | 'no' | 'unknown'
  /** How many sample dates the report shows; more than one is a cumulative report. */
  dates?: number
  /** The time of collection, when printed ("11:21"), for the report's own date. */
  time?: string
}

export const SAMPLE_TITLE = 'Sample report (fictional).png'

function validated(value: unknown): { extraction: Extraction; dropped: number } {
  const v = validateExtraction(value)
  if (!v) throw new AiError('output', "The AI's answer wasn't in the expected format. Try again, or enter the results by hand.")
  if (v.extraction.rows.length === 0) throw new AiError('output', "No results could be read from this report. If it's a photo, try a sharper one.")
  return v
}

/** "12 results on Sep 15, 2026", or for a cumulative report "48 results in 4 reports, Mar 3, 2024 to Sep 15, 2026". */
export function savedSummary(results: number, dates: string[]): string {
  const sorted = [...dates].sort()
  if (sorted.length === 0) return plural(results, 'result')
  if (sorted.length === 1) return `${plural(results, 'result')} on ${formatDate(sorted[0])}`
  return `${plural(results, 'result')} in ${sorted.length} reports, ${formatDate(sorted[0])} to ${formatDate(sorted[sorted.length - 1])}`
}

/** What goes with a group of photos, so the AI numbers the pages the way the review shows them. */
export function pagesNote(count: number): string {
  return `These ${count} images are pages 1 to ${count} of one lab report, in order. Read them as one report; a table may continue from one page to the next. For each row, page is the number of the image it appears on (1 to ${count}).`
}

async function block(doc: StoredDoc, bytes: Uint8Array<ArrayBuffer>): Promise<ContentBlock> {
  if (doc.mimeType === 'application/pdf') return pdfBlock(bytes)
  const small = await shrinkImage(bytes, doc.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
  return imageBlock(small.bytes, small.mediaType)
}

export function labAdapter(deps: {
  store: RecordStore
  profileId: string
  /** For ranges printed by age or sex. */
  profile?: { dateOfBirth?: string; sex?: 'female' | 'male' }
  apiKey?: string
  model: string
  demo: boolean
  aliases: Alias[]
  onSaved: () => Promise<void> | void
}): ImportAdapter<LabMeta> {
  const { store, profileId } = deps
  const mine = async () => {
    const reports = (await store.list<Report>('reports')).filter((r) => r.profileId === profileId)
    const ids = new Set(reports.map((r) => r.id))
    const results = (await store.list<Result>('results')).filter((r) => ids.has(r.reportId))
    return { reports, results }
  }

  const extract = async (blocks: ContentBlock[], text: string) => {
    if (!deps.apiKey) throw new Error('Add your Anthropic API key in Settings to read reports.')
    const { value } = await askJson(
      // A cumulative report with several dates can run to a few hundred rows.
      { apiKey: deps.apiKey, model: deps.model, system: EXTRACTION_SYSTEM, content: [...blocks, { type: 'text', text }], maxTokens: 16000 },
      EXTRACTION_SCHEMA,
      validated,
    )
    return value
  }
  const proposals = (extraction: Extraction, dropped: number) => ({
    rows: toProposedRows(extraction, deps.aliases),
    meta: { lab: extraction.lab ?? '', fasting: parseFasting(extraction.fastingPrinted), dates: printedDates(extraction).length, ...(printedTime(extraction) ? { time: printedTime(extraction) } : {}) },
    dropped,
  })

  return {
    appName: 'LabTrails',
    // "add one in Settings" links here (LAB-14).
    settingsPath: '/app/settings#ai',
    documentKind: 'lab-report',
    noun: { one: 'report', many: 'reports' },
    columns: EXTRACTION_COLUMNS,
    canRead: deps.demo || !!deps.apiKey,
    sample: { url: '/demo/sample-report.png', title: SAMPLE_TITLE },
    sendSheet: {
      notSending: ['Your other results, notes and medications', "Other people's records"],
      notes: ["Reports usually show your name and date of birth, and sometimes a health number. LabTrails can't remove text from a PDF or photo."],
    },
    // Measured on real reports (October 2026): about 2,600 input tokens a PDF page and 110 output
    // tokens a row; a typical report is 2 to 8 pages and 30 to 70 rows.
    estimate: ({ pdfs, images }) => ({ inputTokens: pdfs * 14000 + images * 4000, outputTokens: pdfs * 6500 + images * 3000 }),

    async read(doc, bytes) {
      if (deps.demo) {
        if (doc.title !== SAMPLE_TITLE) throw new Error('In the demo, only the sample report can be read.')
        return proposals(DEMO_EXTRACTION, 0)
      }
      const v = await extract([await block(doc, bytes)], extractionPrompt())
      return proposals(v.extraction, v.dropped)
    },

    // Photos of one paper report, read together so a table that runs across pages comes back as one
    // extraction (coordination request 17). Each row's page is the photo it was read from.
    async readPages(pages) {
      if (deps.demo) throw new Error('In the demo, only the sample report can be read.')
      const blocks = []
      for (const p of pages) blocks.push(await block(p.doc, p.bytes))
      const v = await extract(blocks, `${pagesNote(pages.length)}\n\n${extractionPrompt()}`)
      return proposals(v.extraction, v.dropped)
    },

    async check(result) {
      const { reports, results } = await mine()
      const rows = result.rows as ProposedResultRow[]
      const similar = similarReport(rows, reports, results)
      return {
        alreadySaved: alreadySavedRows(rows, reports, results),
        ...(similar
          ? {
              similar: {
                label: `your report from ${formatDate(similar.report.date)}${similar.report.lab ? ` (${similar.report.lab})` : ''}`,
                detail: `${similar.matched} of ${similar.compared} values match it.`,
              },
            }
          : {}),
      }
    },

    async save(doc: StoredDoc, rows: ConfirmedRow[], meta: LabMeta) {
      const confirmed = rows.map((r) => ({ ...r, value: String(r.value ?? '') })) as unknown as ConfirmedResultRow[]
      const { reports, results } = recordsFromConfirmed(confirmed, {
        profileId,
        documentId: doc.id,
        lab: meta.lab.trim() || null,
        now: new Date().toISOString(),
        newId: () => crypto.randomUUID(),
        profile: deps.profile,
      })
      // On a cumulative report, what's printed about fasting describes this sample: the newest date.
      const newest = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0]
      // The printed time and fasting describe this report's own sample, the newest date.
      for (const r of reports)
        await store.put(
          'reports',
          r === newest ? { ...r, ...(meta.time ? { time: meta.time } : {}), ...(meta.fasting ? { context: { ...r.context, fasting: meta.fasting } } : {}) } : r,
        )
      for (const r of results) await store.put('results', r)
      // Every page of a group carries the report's date and lab, like a single document.
      const latest = (await store.get<StoredDoc>('documents', doc.id)) ?? doc
      const pages = pagesOf(latest, await store.list<StoredDoc>('documents'))
      if (newest) for (const page of pages) await store.put('documents', { ...page, date: newest.date, meta: { ...page.meta, lab: meta.lab.trim() || undefined } })
      await deps.onSaved()
      return savedSummary(results.length, reports.map((r) => r.date))
    },

    MetaEditor: LabMetaEditor,
  }
}
