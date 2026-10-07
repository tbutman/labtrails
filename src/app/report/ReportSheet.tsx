// The one-page doctor report (SPEC.md section 12), drawn as a single SVG so the same drawing prints,
// saves as PDF and exports as PNG. It's a file the user shares, never a link to a server. Plain system
// fonts and fixed colors, because an SVG drawn into a canvas can't load the app's fonts. The same rows
// go in a visually hidden table for screen readers (reportRows).

import { lineFlag, lineText, type PersonalLine } from '../../labs/lines'
import { shownLine } from '../personalLine'
import { describeTiming } from '../../labs/timeline'
import type { MarkerAnalysis, NotRepeated } from '../../labs/analysis'
import { rangeFlag } from '../../labs/flags/flags'
import type { Report } from '../../labs/types'
import { labMarkText } from '../components/Flags'
import { formatDate, formatPoint, formatRange, formatValue, plural } from '../format'

export const SHEET_WIDTH = 800
const INK = '#1D2340'
const MUTED = '#5B6178'
const TEAL = '#0F7A6A'
const TINT = '#DDF1EC'
const PLUM = '#8E2C6B'
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'

const RECENTLY: Record<string, string> = { illness: 'recent illness', 'hard-exercise': 'recent hard exercise', alcohol: 'recent alcohol', 'poor-sleep': 'poor sleep' }

function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > max) {
        if (line) lines.push(line)
        line = word
      } else line = (line + ' ' + word).trim()
    }
    lines.push(line)
  }
  return lines
}

function Spark({ a, x, y, w, h }: { a: MarkerAnalysis; x: number; y: number; w: number; h: number }) {
  const pts = a.series.points.slice(-6)
  const vals = pts.flatMap((p) => [p.value, p.range?.low, p.range?.high]).filter((v): v is number => v !== undefined)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1
  const px = (i: number) => x + (pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w)
  const py = (v: number) => y + h - ((v - lo) / span) * h
  return (
    <g>
      {pts.map((p, i) => (p.range ? <rect key={`r${i}`} x={px(i) - 4} y={py(p.range.high ?? hi)} width={8} height={Math.max(py(p.range.low ?? lo) - py(p.range.high ?? hi), 2)} rx={4} fill={TINT} /> : null))}
      {pts.length > 1 && <polyline points={pts.map((p, i) => `${px(i)},${py(p.value)}`).join(' ')} fill="none" stroke={TEAL} strokeWidth={1.5} />}
      {pts.map((p, i) =>
        rangeFlag(p)?.basis === 'range' ? (
          <circle key={i} cx={px(i)} cy={py(p.value)} r={4.5} fill="#fff" stroke={PLUM} strokeWidth={2} />
        ) : (
          <circle key={i} cx={px(i)} cy={py(p.value)} r={3} fill={TEAL} />
        ),
      )}
    </g>
  )
}

/** One marker's row on the report, as text, for the drawing and the hidden table alike. */
export type ReportRow = {
  id: string
  name: string
  latest: string
  date: string
  range: string
  /** Flags, the lab's mark and any conversion, in the report's words. */
  notes: string[]
  /** Whether the latest result is outside the lab's range (drawn in the flag color). */
  outside: boolean
  previous: string
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

export function reportRows(markers: MarkerAnalysis[], reports: Report[], lines: PersonalLine[]): ReportRow[] {
  const byId = new Map(reports.map((r) => [r.id, r]))
  return markers.map((a) => {
    const unit = a.series.unit
    const latest = a.latest
    const previous = a.series.points.at(-2)
    const f = a.latestFlag
    const line = shownLine(a, lines)
    const lineSide = latest ? lineFlag(latest, line) : null
    const latestLab = latest ? byId.get(latest.reportId)?.lab : undefined
    const previousLab = previous ? byId.get(previous.reportId)?.lab : undefined
    const notes = [
      a.latestCritical?.labMarked ? '! The lab marked this result as critical' : a.latestCritical?.far ? "! Far outside the lab's range" : null,
      f?.basis === 'range' ? `! Outside the lab's range (${f.side})${a.persistent ? ` on the last ${a.persistent.results} tests` : ''}` : null,
      f?.basis === 'lab' ? `Lab marked it ${f.side === 'above' ? 'high' : 'low'}` : null,
      a.labOnlyFlag ? `Lab marked it ${a.labOnlyFlag === 'above' ? 'high' : 'low'}` : null,
      f?.labNormal ? 'Lab marked it normal' : null,
      latest ? labMarkText(latest.flagAsPrinted) : null,
      latest?.printedUnit ? `converted from ${latest.printedUnit}` : null,
      latest?.convertedFrom ? `from ${latest.convertedFrom}` : null,
      a.change?.notable ? (a.change.crossedRange && !f ? "Back inside the lab's range" : 'Changed since the previous result') : null,
      a.trend ? `${a.trend.direction === 'rising' ? 'Rising' : 'Falling'} over ${a.trend.results} results` : null,
      lineSide && line ? `${lineSide === 'above' ? 'Above' : 'Below'} your line (${line.label}: ${lineText(line, formatValue)} ${unit})` : null,
    ].filter((n): n is string => !!n)
    const range = latest ? formatRange(latest.range) : ''
    return {
      id: a.marker.id,
      name: a.marker.name,
      latest: latest ? `${formatPoint(latest)} ${unit}` : '—',
      date: latest ? [formatDate(latest.date), latestLab ? clip(latestLab, 28) : null].filter(Boolean).join(' · ') : '',
      range: latest?.range ? `${range} ${unit}` : range,
      notes,
      outside: f?.basis === 'range',
      previous: previous
        ? [`Previous: ${formatPoint(previous)} (${formatDate(previous.date)})`, previousLab && previousLab !== latestLab ? previousLab : null].filter(Boolean).join(' · ')
        : '',
    }
  })
}

/** The header's second line: the span of results, who prepared it and when, and age and sex if shown. */
export function reportHeader(reports: Report[], preparedOn: string, person?: { age?: number; sex?: 'female' | 'male' }): string {
  const dates = reports.map((r) => r.date).sort()
  return [
    dates.length ? `Results from ${formatDate(dates[0])} to ${formatDate(dates.at(-1)!)}` : null,
    plural(reports.length, 'report'),
    `Prepared by the patient on ${formatDate(preparedOn)}`,
    person?.age !== undefined ? `age ${person.age}` : null,
    person?.sex ?? null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export const REPORT_FOOTER =
  "Prepared by the patient with LabTrails from their own lab reports. Results were typed in or read by AI and checked by the patient; please check against the original reports. Each result is compared with the range printed by its own lab. LabTrails doesn't diagnose or give medical advice."

export const REPORT_TITLE = 'Lab results to discuss with your doctor'

type SheetProps = {
  who: string
  markers: MarkerAnalysis[]
  reports?: Report[]
  latest?: Report
  notes: string
  missing?: NotRepeated[]
  timeline?: string[]
  lines?: PersonalLine[]
  preparedOn?: string
  person?: { age?: number; sex?: 'female' | 'male' }
  /** The id of the hidden table with the same rows. */
  describedBy?: string
}

export function ReportSheet({ who, markers, reports = [], latest, notes, missing = [], timeline = [], lines = [], preparedOn = new Date().toISOString().slice(0, 10), person, describedBy }: SheetProps) {
  const top = 176
  const rows = reportRows(markers, reports, lines)
  // Flags wrap onto more lines rather than being cut off, so each row is as tall as its notes need.
  const rowNotes = rows.map((r) => (r.notes.length ? wrap(r.notes.join(' · '), 108) : []))
  const rowTops = rowNotes.reduce<number[]>((acc, n, i) => [...acc, acc[i] + 70 + Math.max(n.length, 1) * 16], [top])
  const context = latest?.context
  const contextText = context
    ? [
        context.fasting === 'yes' ? 'fasting' : context.fasting === 'no' ? 'not fasting' : null,
        ...(context.recently ?? []).map((r) => RECENTLY[r]),
        context.medications ? `medications: ${context.medications}` : null,
        ...(context.doseTiming ?? []).map((t) => `drawn ${describeTiming(t, latest!.date)}`),
        context.notes ? `notes: ${context.notes}` : null,
      ]
        .filter(Boolean)
        .join('; ')
    : ''
  const contextLines = [
    ...(contextText ? wrap(`Latest test: ${contextText}`, 100) : []),
    ...(missing.length ? wrap(`Not in the latest report: ${missing.map((m) => `${m.name} (last ${formatDate(m.lastDate)})`).join(', ')}`, 100) : []),
    ...(timeline.length ? wrap(`Timeline: ${timeline.join('; ')}`, 100) : []),
  ]
  const headerLines = wrap(reportHeader(reports, preparedOn, person), 104)
  const noteLines = notes.trim() ? wrap(notes.trim(), 100) : []
  const afterRows = (rows.length ? rowTops[rows.length] : top + 60)
  const notesTop = afterRows + contextLines.length * 18 + (contextLines.length ? 16 : 0)
  const footTop = notesTop + (noteLines.length ? 28 + noteLines.length * 18 : 0) + 24
  const footLines = wrap(REPORT_FOOTER, 118)
  const height = footTop + footLines.length * 16 + 30
  const shift = (headerLines.length - 1) * 16

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SHEET_WIDTH} ${height + shift}`}
      width={SHEET_WIDTH}
      height={height + shift}
      fontFamily={FONT}
      role="img"
      aria-label={`${REPORT_TITLE}, for ${who}`}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
    >
      <rect width={SHEET_WIDTH} height={height + shift} fill="#fff" />
      <text x={40} y={52} fontSize={24} fontWeight={700} fill={INK}>
        {REPORT_TITLE}
      </text>
      <text x={40} y={78} fontSize={14} fill={INK}>
        {who}
        {latest ? ` · latest test ${formatDate(latest.date)}${latest.lab ? ` · ${latest.lab}` : ''}` : ''}
      </text>
      {headerLines.map((line, i) => (
        <text key={`h${i}`} x={40} y={98 + i * 16} fontSize={12} fill={MUTED}>
          {line}
        </text>
      ))}
      <g transform={`translate(0 ${shift})`}>
        <text x={40} y={138} fontSize={12} fill={MUTED}>
          Marker
        </text>
        <text x={300} y={138} fontSize={12} fill={MUTED}>
          Latest
        </text>
        <text x={430} y={138} fontSize={12} fill={MUTED}>
          Lab's range
        </text>
        <text x={590} y={138} fontSize={12} fill={MUTED}>
          Last results
        </text>
        <line x1={40} x2={SHEET_WIDTH - 40} y1={148} y2={148} stroke={INK} />

        {rows.length === 0 && (
          <text x={40} y={top + 10} fontSize={14} fill={MUTED}>
            No markers selected.
          </text>
        )}
        {rows.map((row, i) => {
          const y = rowTops[i]
          const below = y + 40 + Math.max(rowNotes[i].length, 1) * 16
          return (
            <g key={row.id}>
              <text x={40} y={y + 4} fontSize={15} fontWeight={600} fill={INK}>
                {row.name}
              </text>
              <text x={300} y={y + 4} fontSize={15} fontWeight={600} fill={row.outside ? PLUM : INK}>
                {row.latest}
              </text>
              <text x={300} y={y + 22} fontSize={12} fill={MUTED}>
                {row.date}
              </text>
              <text x={430} y={y + 4} fontSize={13} fill={INK}>
                {row.range}
              </text>
              {rowNotes[i].map((line, j) => (
                <text key={j} x={40} y={y + 40 + j * 16} fontSize={12} fill={row.outside ? PLUM : INK} fontWeight={row.outside ? 600 : 400}>
                  {line}
                </text>
              ))}
              <text x={40} y={below} fontSize={12} fill={MUTED}>
                {row.previous}
              </text>
              <Spark a={markers[i]} x={590} y={y - 12} w={160} h={34} />
              <line x1={40} x2={SHEET_WIDTH - 40} y1={below + 10} y2={below + 10} stroke="#E4DFD2" />
            </g>
          )
        })}

        {contextLines.map((line, i) => (
          <text key={`c${i}`} x={40} y={afterRows + i * 18} fontSize={13} fill={INK}>
            {line}
          </text>
        ))}
        {noteLines.length > 0 && (
          <>
            <text x={40} y={notesTop + 6} fontSize={14} fontWeight={600} fill={INK}>
              My notes and questions
            </text>
            {noteLines.map((line, i) => (
              <text key={`n${i}`} x={40} y={notesTop + 28 + i * 18} fontSize={13} fill={INK}>
                {line}
              </text>
            ))}
          </>
        )}
        {footLines.map((line, i) => (
          <text key={`f${i}`} x={40} y={footTop + i * 16} fontSize={11} fill={MUTED}>
            {line}
          </text>
        ))}
      </g>
    </svg>
  )
}

/** The report's rows as a table, visually hidden, for screen readers (LAB-16). */
export function ReportTable({ id, who, header, rows }: { id: string; who: string; header: string; rows: ReportRow[] }) {
  return (
    // In a hidden div: a table ignores the 1px width of .sr-only and would widen the page.
    <div className="sr-only">
    <table id={id}>
      <caption>
        {REPORT_TITLE}, for {who}. {header}.
      </caption>
      <thead>
        <tr>
          <th scope="col">Marker</th>
          <th scope="col">Latest</th>
          <th scope="col">Date</th>
          <th scope="col">Lab's range</th>
          <th scope="col">Notes</th>
          <th scope="col">Previous</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row">{r.name}</th>
            <td>{r.latest}</td>
            <td>{r.date}</td>
            <td>{r.range}</td>
            <td>{r.notes.join('; ')}</td>
            <td>{r.previous}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
