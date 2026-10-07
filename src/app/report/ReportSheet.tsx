import { describeTiming } from '../../labs/timeline'
// The one-page doctor-visit report (SPEC.md section 12), drawn as a single SVG so the same drawing
// prints, saves as PDF and exports as PNG. It's a file the user shares, never a link to a server.
// Plain system fonts and fixed colours, because an SVG drawn into a canvas can't load the app's fonts.

import type { MarkerAnalysis, NotRepeated } from '../../labs/analysis'
import { rangeFlag } from '../../labs/flags/flags'
import type { Report } from '../../labs/types'
import { DISCLAIMER } from '../components/Flags'
import { formatDate, formatPoint, formatRange } from '../format'

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

export function ReportSheet({ who, markers, latest, notes, missing = [], timeline = [] }: { who: string; markers: MarkerAnalysis[]; latest?: Report; notes: string; missing?: NotRepeated[]; timeline?: string[] }) {
  const rowH = 58
  const top = 150
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
  const noteLines = notes.trim() ? wrap(notes.trim(), 100) : []
  const afterRows = top + Math.max(markers.length, 1) * rowH + 20
  const notesTop = afterRows + contextLines.length * 18 + (contextLines.length ? 16 : 0)
  const footTop = notesTop + (noteLines.length ? 28 + noteLines.length * 18 : 0) + 24
  const height = footTop + 70

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SHEET_WIDTH} ${height}`} width={SHEET_WIDTH} height={height} fontFamily={FONT} role="img" aria-label={`Lab results report for ${who}`}>
      <rect width={SHEET_WIDTH} height={height} fill="#fff" />
      <text x={40} y={52} fontSize={24} fontWeight={700} fill={INK}>
        Lab results to discuss
      </text>
      <text x={40} y={78} fontSize={14} fill={MUTED}>
        {who}
        {latest ? ` · latest test ${formatDate(latest.date)}${latest.lab ? ` · ${latest.lab}` : ''}` : ''}
      </text>
      <text x={40} y={112} fontSize={12} fill={MUTED}>
        Marker
      </text>
      <text x={300} y={112} fontSize={12} fill={MUTED}>
        Latest
      </text>
      <text x={430} y={112} fontSize={12} fill={MUTED}>
        Lab's range
      </text>
      <text x={590} y={112} fontSize={12} fill={MUTED}>
        Last results
      </text>
      <line x1={40} x2={SHEET_WIDTH - 40} y1={122} y2={122} stroke={INK} />

      {markers.length === 0 && (
        <text x={40} y={top + 10} fontSize={14} fill={MUTED}>
          No markers selected.
        </text>
      )}
      {markers.map((a, i) => {
        const y = top + i * rowH
        const f = a.latestFlag
        const notes = [
          f?.basis === 'range' ? `! Outside the lab's range (${f.side})${a.persistent ? ` on the last ${a.persistent.results} tests` : ''}` : null,
          a.change?.notable ? `Changed since last time` : null,
          a.trend ? `${a.trend.direction === 'rising' ? 'Rising' : 'Falling'} over ${a.trend.results} results` : null,
        ].filter(Boolean)
        return (
          <g key={a.marker.id}>
            <text x={40} y={y + 4} fontSize={15} fontWeight={600} fill={INK}>
              {a.marker.name}
            </text>
            <text x={40} y={y + 24} fontSize={12} fill={f?.basis === 'range' ? PLUM : MUTED} fontWeight={f?.basis === 'range' ? 600 : 400}>
              {notes.join(' · ')}
            </text>
            <text x={300} y={y + 4} fontSize={15} fontWeight={600} fill={f?.basis === 'range' ? PLUM : INK}>
              {a.latest ? `${formatPoint(a.latest)} ${a.series.unit}` : '—'}
            </text>
            <text x={430} y={y + 4} fontSize={13} fill={INK}>
              {formatRange(a.latest?.range)}
            </text>
            <Spark a={a} x={590} y={y - 12} w={160} h={34} />
            <line x1={40} x2={SHEET_WIDTH - 40} y1={y + 38} y2={y + 38} stroke="#E4DFD2" />
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
      {wrap(`Made with LabTrails. Each result is compared with the range printed by its own lab. ${DISCLAIMER}`, 118).map((line, i) => (
        <text key={`f${i}`} x={40} y={footTop + i * 16} fontSize={11} fill={MUTED}>
          {line}
        </text>
      ))}
    </svg>
  )
}
