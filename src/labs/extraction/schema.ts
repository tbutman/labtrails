// The structured output the AI must return when reading a lab report (SPEC.md section 10), and the
// validation that runs on whatever actually comes back. The AI only copies text as printed; the code
// parses numbers, matches markers and decides flags. The schema holds no personal data.

import { MARKERS } from '../catalogue/catalogue'

export type DateFormat = 'DMY' | 'MDY' | 'YMD' | 'unknown'
export type Confidence = 'high' | 'medium' | 'low'

export type ExtractedRow = {
  nameAsPrinted: string
  valuePrinted: string
  unitPrinted: string | null
  rangePrinted: string | null
  flagPrinted: string | null
  suggestedMarkerId: string // a catalogue ID or 'unknown'
  confidence: Confidence
  page: number
  /**
   * This result's own sample date, as printed, on a cumulative report that shows several dates
   * (earlier results in columns, or a history list); null when the report has one sample date.
   */
  samplePrinted: string | null
}

export type Extraction = {
  sampleDate: { printed: string; guessedFormat: DateFormat } | null
  lab: string | null
  /** Whether the report says the sample was taken fasting, as printed ("Jejum: sim"), or null. */
  fastingPrinted: string | null
  rows: ExtractedRow[]
}

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }

/** JSON Schema for Anthropic's structured outputs (`output_config.format`). */
export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sampleDate', 'lab', 'fastingPrinted', 'rows'],
  properties: {
    sampleDate: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['printed', 'guessedFormat'],
          properties: { printed: { type: 'string' }, guessedFormat: { type: 'string', enum: ['DMY', 'MDY', 'YMD', 'unknown'] } },
        },
        { type: 'null' },
      ],
    },
    lab: nullableString,
    fastingPrinted: nullableString,
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nameAsPrinted', 'valuePrinted', 'unitPrinted', 'rangePrinted', 'flagPrinted', 'suggestedMarkerId', 'confidence', 'page', 'samplePrinted'],
        properties: {
          nameAsPrinted: { type: 'string' },
          valuePrinted: { type: 'string' },
          unitPrinted: nullableString,
          rangePrinted: nullableString,
          flagPrinted: nullableString,
          suggestedMarkerId: { type: 'string', enum: [...MARKERS.map((m) => m.id), 'unknown'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          page: { type: 'integer' },
          samplePrinted: nullableString,
        },
      },
    },
  },
} as const

const MAX_TEXT = 200
const MAX_ROWS = 300
const IDS = new Set([...MARKERS.map((m) => m.id), 'unknown'])

export type ValidationResult = { extraction: Extraction; dropped: number; errors: string[] }

/**
 * Checks AI output against the schema, row by row. Rows that don't fit are dropped (and counted, so
 * the review screen can say "couldn't read part of this report"); the rest are kept. Returns null if
 * the output isn't an extraction at all. Never trusts the structure of what came back.
 */
export function validateExtraction(raw: unknown): ValidationResult | null {
  if (!isObject(raw) || !Array.isArray(raw.rows)) return null
  const errors: string[] = []

  let sampleDate: Extraction['sampleDate'] = null
  if (isObject(raw.sampleDate) && isText(raw.sampleDate.printed) && ['DMY', 'MDY', 'YMD', 'unknown'].includes(raw.sampleDate.guessedFormat as string)) {
    sampleDate = { printed: raw.sampleDate.printed, guessedFormat: raw.sampleDate.guessedFormat as DateFormat }
  } else if (raw.sampleDate !== null && raw.sampleDate !== undefined) {
    errors.push('sampleDate')
  }
  const lab = isText(raw.lab) ? raw.lab : null
  const fastingPrinted = isText(raw.fastingPrinted) ? raw.fastingPrinted : null

  const rows: ExtractedRow[] = []
  let dropped = 0
  for (const r of raw.rows.slice(0, MAX_ROWS)) {
    if (
      isObject(r) &&
      isText(r.nameAsPrinted) &&
      r.nameAsPrinted.trim() &&
      isText(r.valuePrinted) &&
      r.valuePrinted.trim() &&
      isTextOrNull(r.unitPrinted) &&
      isTextOrNull(r.rangePrinted) &&
      isTextOrNull(r.flagPrinted) &&
      typeof r.suggestedMarkerId === 'string' &&
      ['high', 'medium', 'low'].includes(r.confidence as string) &&
      Number.isInteger(r.page) &&
      (r.page as number) >= 1
    ) {
      rows.push({
        nameAsPrinted: r.nameAsPrinted.trim(),
        valuePrinted: r.valuePrinted.trim(),
        unitPrinted: r.unitPrinted?.trim() || null,
        rangePrinted: r.rangePrinted?.trim() || null,
        flagPrinted: r.flagPrinted?.trim() || null,
        // An ID outside the catalogue is treated as no suggestion, not as an error.
        suggestedMarkerId: IDS.has(r.suggestedMarkerId) ? r.suggestedMarkerId : 'unknown',
        confidence: r.confidence as Confidence,
        page: r.page as number,
        // Optional for older answers; anything that isn't text means "the report's own date".
        samplePrinted: isText(r.samplePrinted) && r.samplePrinted.trim() ? r.samplePrinted.trim() : null,
      })
    } else {
      dropped++
    }
  }
  dropped += Math.max(0, raw.rows.length - MAX_ROWS)
  return { extraction: { sampleDate, lab, fastingPrinted, rows }, dropped, errors }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isText(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_TEXT
}
function isTextOrNull(v: unknown): v is string | null {
  return v === null || isText(v)
}
