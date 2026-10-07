// The live extraction check: runs LabTrails' real reading (the same system prompt, schema, validation,
// matching and saving as the app) on the fictional reports in tests/fixtures/reports, and compares the
// result with expected.json row by row. It calls Anthropic, so it needs a key and costs a few cents:
//
//   ANTHROPIC_API_KEY=… npm run test:live
//
// Not part of CI. Run it after changing the extraction prompt, schema, matching or range parsing.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXTRACTION_COLUMNS } from '../../src/app/extractionColumns'
import { pagesNote } from '../../src/app/import/labAdapter'
import { askJson, imageBlock, pdfBlock, type ContentBlock } from '../../src/core/ai/client'
import { confirmedRows, parseDate, type DateOrder, type ReviewRow } from '../../src/core/review/model'
import { EXTRACTION_SYSTEM } from '../../src/labs/ai/prompts'
import { extractionPrompt, recordsFromConfirmed, toProposedRows, type ConfirmedResultRow, type ProposedResultRow } from '../../src/labs/extraction/proposals'
import { EXTRACTION_SCHEMA, validateExtraction } from '../../src/labs/extraction/schema'
import { parseValue } from '../../src/labs/units/parse'

type Expected = { page: number; date: string; name: string; value: string; unit: string; range: string; specimen: string; marker: string; previous?: boolean }
type Report = { files: string[]; lab: string; sample: { iso: string; time?: string }; order: DateOrder; person: { dateOfBirth: string; sex: 'male' | 'female' }; rows: Expected[] }

const dir = 'tests/fixtures/reports'
const expected: Record<string, Report> = JSON.parse(readFileSync(`${dir}/expected.json`, 'utf8'))
const apiKey = process.env.ANTHROPIC_API_KEY
const model = process.env.LABTRAILS_MODEL ?? 'claude-sonnet-5-5'

const sameValue = (a: string, b: string) => {
  const x = parseValue(a, '.')
  const y = parseValue(b, '.')
  return x.kind === 'number' && y.kind === 'number' ? x.value === y.value && (x.comparator ?? '') === (y.comparator ?? '') : a.trim().toLowerCase() === b.trim().toLowerCase()
}
const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

async function read(report: Report) {
  const blocks: ContentBlock[] = report.files.map((f) => {
    const bytes = new Uint8Array(readFileSync(`${dir}/${f}`))
    return f.endsWith('.pdf') ? pdfBlock(bytes) : imageBlock(bytes, 'image/jpeg')
  })
  const text = report.files.length > 1 ? `${pagesNote(report.files.length)}\n\n${extractionPrompt()}` : extractionPrompt()
  const { value } = await askJson({ apiKey: apiKey!, model, system: EXTRACTION_SYSTEM, content: [...blocks, { type: 'text', text }], maxTokens: 16000 }, EXTRACTION_SCHEMA, (v) => {
    const r = validateExtraction(v)
    if (!r) throw new Error('not an extraction')
    return r
  })
  return value
}

describe.skipIf(!apiKey)('live extraction of the fictional test reports', () => {
  for (const [id, report] of Object.entries(expected)) {
    it(id, { timeout: 240_000 }, async () => {
      const { extraction, dropped } = await read(report)
      const rows = toProposedRows(extraction)
      mkdirSync('test-results/live-extraction', { recursive: true })
      writeFileSync(`test-results/live-extraction/${id}.json`, JSON.stringify({ extraction, rows }, null, 2))

      const problems: string[] = []
      if (dropped) problems.push(`${dropped} rows dropped by validation`)
      if (extraction.lab && !simplify(extraction.lab).includes(simplify(report.lab.replace(/\(fictional\)/, '')))) problems.push(`lab read as "${extraction.lab}"`)

      // Every expected row is there, on the right date, with the right value, sample type and marker.
      const isoOf = (r: ProposedResultRow) => parseDate(r.values.date, report.order)
      const used = new Set<ProposedResultRow>()
      for (const e of report.rows) {
        const found = rows.find((r) => !used.has(r) && isoOf(r) === e.date && sameValue(r.values.value, e.value) && simplify(r.values.name).includes(simplify(e.name).slice(0, 6)))
        if (!found) {
          problems.push(`missing: ${e.date} ${e.name} ${e.value}`)
          continue
        }
        used.add(found)
        if (found.values.specimen !== e.specimen) problems.push(`${e.name}: sample "${found.values.specimen}", expected "${e.specimen}"`)
        if (found.values.marker !== e.marker) problems.push(`${e.date} ${e.name}: marker "${found.values.marker || 'none'}", expected "${e.marker || 'none'}"`)
        if (found.confidence === 'low') problems.push(`${e.date} ${e.name}: marked Unsure`)
        if (e.previous && e.range && !found.values.range) problems.push(`${e.date} ${e.name}: previous result has no range`)
      }
      for (const r of rows) if (!used.has(r)) problems.push(`extra row: ${r.values.date} ${r.values.name} ${r.values.value}`)

      // After review and saving: banded ranges take the right band for this person.
      const review: ReviewRow[] = [...used].map((r, i) => ({ id: String(i), values: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, String(v)])), confidence: r.confidence, status: 'accepted' }))
      const confirmed = confirmedRows(review, EXTRACTION_COLUMNS, report.order) as unknown as ConfirmedResultRow[]
      const { results } = recordsFromConfirmed(confirmed, { profileId: 'p', now: 'now', newId: () => crypto.randomUUID(), profile: report.person })
      const bands: Record<string, { low?: number; high?: number }> = { 'free-testosterone': { low: 3.6, high: 25.7 }, psa: { low: 0, high: 2.5 }, 'vitamin-d': { low: 30, high: 100 } }
      for (const r of results.filter((x) => x.markerId && bands[x.markerId] && x.range)) {
        if (r.range!.low !== bands[r.markerId!].low || r.range!.high !== bands[r.markerId!].high) problems.push(`${r.nameAsPrinted}: range ${JSON.stringify(r.range)}, expected band ${JSON.stringify(bands[r.markerId!])}`)
      }

      expect(problems, `${id}: ${rows.length} rows read`).toEqual([])
    })
  }
})
