// LabTrails' plug-in for the shared import (src/core/import): how a lab report is read, what counts
// as already saved, and what saving creates.

import type { RecordStore } from '../../core'
import { AiError, askJson, imageBlock, pdfBlock, shrinkImage, type ContentBlock } from '../../core/ai/client'
import type { ConfirmedRow } from '../../core/review/model'
import { EXTRACTION_SYSTEM } from '../../labs/ai/prompts'
import { alreadySavedRows, parseFasting, similarReport } from '../../labs/extraction/duplicates'
import { extractionPrompt, printedDates, recordsFromConfirmed, toProposedRows, type ConfirmedResultRow, type ProposedResultRow } from '../../labs/extraction/proposals'
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
}

export const SAMPLE_TITLE = 'Sample report (fictional).png'

function validated(value: unknown): { extraction: Extraction; dropped: number } {
  const v = validateExtraction(value)
  if (!v) throw new AiError('output', "The AI's answer wasn't in the expected format. Try again, or enter the results by hand.")
  if (v.extraction.rows.length === 0) throw new AiError('output', "No results could be read from this report. If it's a photo, try a sharper one.")
  return v
}

/** "12 results on 15 Sept 2026", or for a cumulative report "48 results in 4 reports, 3 Mar 2024 to 15 Sept 2026". */
export function savedSummary(results: number, dates: string[]): string {
  const sorted = [...dates].sort()
  if (sorted.length === 0) return plural(results, 'result')
  if (sorted.length === 1) return `${plural(results, 'result')} on ${formatDate(sorted[0])}`
  return `${plural(results, 'result')} in ${sorted.length} reports, ${formatDate(sorted[0])} to ${formatDate(sorted[sorted.length - 1])}`
}

export function labAdapter(deps: {
  store: RecordStore
  profileId: string
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

  return {
    appName: 'LabTrails',
    documentKind: 'lab-report',
    noun: { one: 'report', many: 'reports' },
    columns: EXTRACTION_COLUMNS,
    canRead: deps.demo || !!deps.apiKey,
    sample: { url: '/demo/sample-report.png', title: SAMPLE_TITLE },
    sendSheet: {
      notSending: ['Your other results, notes and medications', "Other people's records"],
      notes: ["Reports usually show your name and date of birth, and sometimes a health number. LabTrails can't remove text from a PDF or photo."],
    },
    estimate: ({ pdfs, images }) => ({ inputTokens: pdfs * 9000 + images * 4000, outputTokens: (pdfs + images) * 2000 }),

    async read(doc, bytes) {
      let extraction: Extraction
      let dropped = 0
      if (deps.demo) {
        if (doc.title !== SAMPLE_TITLE) throw new Error('In the demo, only the sample report can be read.')
        extraction = DEMO_EXTRACTION
      } else {
        if (!deps.apiKey) throw new Error('Add your Anthropic API key in Settings to read reports.')
        let block: ContentBlock
        if (doc.mimeType === 'application/pdf') block = pdfBlock(bytes)
        else {
          const small = await shrinkImage(bytes, doc.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
          block = imageBlock(small.bytes, small.mediaType)
        }
        const { value } = await askJson(
          // A cumulative report with several dates can run to a few hundred rows.
          { apiKey: deps.apiKey, model: deps.model, system: EXTRACTION_SYSTEM, content: [block, { type: 'text', text: extractionPrompt() }], maxTokens: 16000 },
          EXTRACTION_SCHEMA,
          validated,
        )
        extraction = value.extraction
        dropped = value.dropped
      }
      return {
        rows: toProposedRows(extraction, deps.aliases),
        meta: { lab: extraction.lab ?? '', fasting: parseFasting(extraction.fastingPrinted), dates: printedDates(extraction).length },
        dropped,
      }
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
      })
      // On a cumulative report, what's printed about fasting describes this sample: the newest date.
      const newest = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0]
      for (const r of reports) await store.put('reports', meta.fasting && r === newest ? { ...r, context: { ...r.context, fasting: meta.fasting } } : r)
      for (const r of results) await store.put('results', r)
      const latest = (await store.get<StoredDoc>('documents', doc.id)) ?? doc
      if (newest) await store.put('documents', { ...latest, date: newest.date, meta: { ...latest.meta, lab: meta.lab.trim() || undefined } })
      await deps.onSaved()
      return savedSummary(results.length, reports.map((r) => r.date))
    },

    MetaEditor: LabMetaEditor,
  }
}
