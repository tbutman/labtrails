// The review step's rules, kept free of UI so they can be tested: AI-proposed rows are edited by the
// user, and only rows the user has accepted, and that pass validation, ever reach the app.

export type Confidence = 'high' | 'medium' | 'low'
export type ColumnType = 'text' | 'number' | 'date' | 'choice'

export type Column = {
  key: string
  label: string
  type: ColumnType
  unit?: string
  required?: boolean
  // For 'choice' columns.
  options?: { value: string; label: string }[]
  // Extra checks, after the type's own; return a message for the user, or undefined. Receives the
  // cleaned value: numbers with a decimal point, dates as YYYY-MM-DD.
  validate?: (value: string, row: Record<string, string>) => string | undefined
  // A softer check that doesn't block saving: something worth a second look ("far above the chart
  // for this age"). Receives the cleaned value and the whole row, cleaned (numbers as numbers, dates
  // as YYYY-MM-DD); only called when the row has no errors.
  warn?: (value: string, row: Record<string, string | number | undefined>) => string | undefined
}

export type ProposedRow = {
  values: Record<string, string | number | null | undefined>
  confidence: Confidence
  // What the document says, as printed, so the user can compare.
  sourceText?: string
  page?: number
}

export type RowStatus = 'pending' | 'accepted' | 'rejected'

export type ReviewRow = {
  id: string
  // Values as text, the way the user edits them.
  values: Record<string, string>
  confidence: Confidence
  sourceText?: string
  page?: number
  status: RowStatus
  added?: boolean
}

export type DateOrder = 'dmy' | 'mdy'

// "5,4" and "5.4" both mean 5.4; "1.234,5" and "1,234.5" both mean 1234.5. The last separator is the
// decimal point when both appear.
export function normaliseNumber(text: string): string {
  const t = text.trim().replace(/\s/g, '')
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    return lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  }
  return t.replace(',', '.')
}

const DATE_PARTS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/

// The date order a document must use, if any of its dates gives it away (a first part over 12 means
// day first; a second part over 12 means month first). Undefined when every date is ambiguous.
export function detectDateOrder(raws: string[]): DateOrder | undefined {
  for (const raw of raws) {
    const m = DATE_PARTS.exec(raw.trim())
    if (!m) continue
    if (Number(m[1]) > 12) return 'dmy'
    if (Number(m[2]) > 12) return 'mdy'
  }
  return undefined
}

export function needsDateOrder(raws: string[]): boolean {
  return detectDateOrder(raws) === undefined && raws.some((raw) => {
    const m = DATE_PARTS.exec(raw.trim())
    return !!m && m[1] !== m[2]
  })
}

// Turns a printed date into YYYY-MM-DD. ISO dates pass through; d/m/y needs to know the order unless
// it's unambiguous. Returns undefined when it can't tell or the date doesn't exist.
export function parseDate(raw: string, order?: DateOrder): string | undefined {
  const text = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  let y: number, mo: number, d: number
  if (iso) {
    ;[y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  } else {
    const m = DATE_PARTS.exec(text)
    if (!m) return undefined
    const [a, b] = [Number(m[1]), Number(m[2])]
    y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const resolved = order ?? (a > 12 ? 'dmy' : b > 12 ? 'mdy' : a === b ? 'dmy' : undefined)
    if (!resolved) return undefined
    ;[d, mo] = resolved === 'dmy' ? [a, b] : [b, a]
  }
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

let counter = 0
const newId = () => `row-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function initRows(proposed: ProposedRow[], columns: Column[]): ReviewRow[] {
  return proposed.map((p) => ({
    id: newId(),
    values: Object.fromEntries(
      columns.map((c) => {
        const v = p.values[c.key]
        const text = v === null || v === undefined ? '' : String(v)
        return [c.key, c.type === 'number' && text ? normaliseNumber(text) : text]
      }),
    ),
    confidence: p.confidence,
    sourceText: p.sourceText,
    page: p.page,
    status: 'pending',
  }))
}

export function blankRow(columns: Column[]): ReviewRow {
  return { id: newId(), values: Object.fromEntries(columns.map((c) => [c.key, ''])), confidence: 'high', status: 'pending', added: true }
}

// The raw printed dates in the rows, for the day/month question.
export function rawDates(rows: ReviewRow[], columns: Column[]): string[] {
  const keys = columns.filter((c) => c.type === 'date').map((c) => c.key)
  return rows.flatMap((r) => keys.map((k) => r.values[k]).filter(Boolean))
}

export function rowErrors(row: ReviewRow, columns: Column[], order?: DateOrder): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const c of columns) {
    const value = (row.values[c.key] ?? '').trim()
    if (!value) {
      if (c.required) errors[c.key] = `${c.label} is needed.`
      continue
    }
    if (c.type === 'number' && !/^\d+(\.\d+)?$/.test(normaliseNumber(value))) errors[c.key] = "That isn't a number."
    else if (c.type === 'date' && !parseDate(value, order)) errors[c.key] = order ? "That isn't a valid date." : 'Say whether dates are day first or month first.'
    else if (c.type === 'choice' && !c.options?.some((o) => o.value === value)) errors[c.key] = 'Choose one of the options.'
    else {
      // Validators see the cleaned value: a plain number, or a YYYY-MM-DD date.
      const clean = c.type === 'number' ? normaliseNumber(value) : c.type === 'date' ? parseDate(value, order)! : value
      const custom = c.validate?.(clean, row.values)
      if (custom) errors[c.key] = custom
    }
  }
  return errors
}

// Warnings for a row with no errors: each column's warn, given the cleaned row.
export function rowWarnings(row: ReviewRow, columns: Column[], order?: DateOrder): Record<string, string> {
  if (!columns.some((c) => c.warn) || Object.keys(rowErrors(row, columns, order)).length) return {}
  const clean = cleanRow(row, columns, order)
  const warnings: Record<string, string> = {}
  for (const c of columns) {
    const value = clean[c.key]
    if (value === undefined || !c.warn) continue
    const message = c.warn(String(value), clean)
    if (message) warnings[c.key] = message
  }
  return warnings
}

function cleanRow(r: ReviewRow, columns: Column[], order?: DateOrder): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {}
  for (const c of columns) {
    const value = (r.values[c.key] ?? '').trim()
    if (!value) out[c.key] = undefined
    else if (c.type === 'number') out[c.key] = Number(normaliseNumber(value))
    else if (c.type === 'date') out[c.key] = parseDate(value, order)
    else out[c.key] = value
  }
  return out
}

export type ConfirmedRow = Record<string, string | number | undefined> & { sourceText?: string; page?: number }

// The only way values leave the review: accepted rows that pass every check, converted to numbers
// and ISO dates. Pending and rejected rows are never included.
export function confirmedRows(rows: ReviewRow[], columns: Column[], order?: DateOrder): ConfirmedRow[] {
  return rows
    .filter((r) => r.status === 'accepted' && Object.keys(rowErrors(r, columns, order)).length === 0)
    .map((r): ConfirmedRow => ({ sourceText: r.sourceText, page: r.page, ...cleanRow(r, columns, order) }))
}
