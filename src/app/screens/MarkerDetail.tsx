import { INFLUENCE_NAMES, effectWords, influencesFor, lowerFirst, matchInfluences, matchedSentence } from '../../labs/influences'
import { describeTiming, type TimelineEntry } from '../../labs/timeline'
import type { Report } from '../../labs/types'
import { Info, Minus, NotebookPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { analyseMarker, type MarkerAnalysis } from '../../labs/analysis'
import { lineIn, lineText, validateLine, type PersonalLine } from '../../labs/lines'
import { getMarker } from '../../labs/catalogue/catalogue'
import { CHANGE_THRESHOLD, TREND_THRESHOLD, changeBasis } from '../../labs/flags/flags'
import { convertibleUnits } from '../../labs/units/convert'
import { Callout, PageHeader, SelectField, TextField } from '../../core/ui/components'
import { CriticalNotice, DISCLAIMER, MarkerFlags, RangeMeaning, changeAmount, labMarkText } from '../components/Flags'
import { chartEvents } from '../chartEvents'
import { personalFlag, shownLine } from '../personalLine'
import { MarkerChart, ResultsList } from '../components/MarkerChart'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPercent, formatPoint, formatRange, formatValue, formatWhen, labRange, unitLabel } from '../format'

const BASIS_WORDS = { width: "the lab's range width", limit: "the lab's limit", previous: 'the previous value' } as const

const RECENTLY: Record<string, string> = { illness: 'recent illness', 'hard-exercise': 'recent hard exercise', alcohol: 'recent alcohol', 'poor-sleep': 'poor sleep' }

export function MarkerDetail() {
  const { id = '' } = useParams()
  const { reports, results, timeline, lines } = useProfileData()
  const base = useBase()
  const { app, saveApp } = useSession()
  const [unit, setUnit] = useState<string | undefined>(app.preferredUnit[id])
  const reportsById = new Map(reports.map((r) => [r.id, r]))
  const marker = getMarker(id)
  const a = marker ? analyseMarker(id, results, reportsById, unit) : null

  if (!marker || !a) {
    return (
      <>
        <PageHeader title="Marker not found" back={{ to: base, label: 'Overview' }} />
        <Link to={base}>Back to the overview</Link>
      </>
    )
  }

  const units = a.latest ? convertibleUnits(marker, a.series.unit) : []
  const withContext = a.series.points
    .map((p) => ({ p, report: reportsById.get(p.reportId)! }))
    .filter(({ report }) => report.context && (report.context.fasting === 'no' || report.context.recently?.length || report.context.notes || report.context.doseTiming?.length))

  return (
    <>
      <PageHeader
        title={marker.name}
        subtitle={(() => {
          const shown = a.latestUnconverted ?? a.latest
          const unit = a.latestUnconverted ? a.latestUnconverted.unit : a.series.unit
          return shown
            ? [`${formatPoint(shown)} ${unitLabel(unit)} on ${formatDate(shown.date)}`, labRange(shown.range, 'lab'), labMarkText(shown.flagAsPrinted)?.replace(/^L/, 'l')].filter(Boolean).join(' · ')
            : undefined
        })()}
        back={{ to: base, label: 'Overview' }}
      />
      <div className="row chips-row">
        <MarkerFlags a={a} line={personalFlag(a, lines)} />
      </div>
      {a.latestFlag?.labNormal && (a.latestUnconverted ?? a.latest) && (
        <p className="hint">
          The lab marked this normal; the printed range is {formatRange((a.latestUnconverted ?? a.latest)!.range)}.
        </p>
      )}
      <CriticalNotice a={a} />
      {a.latestFlag && <RangeMeaning />}

      <div className="card chart-card">
        <div className="card-header">
          <h2 className="card-title">Over time</h2>
          {units.length > 1 && (
            <label className="unit-switch">
              <span className="sr-only">Show in</span>
              <select
                aria-label="Show in"
                value={a.series.unit}
                onChange={(e) => {
                  setUnit(e.target.value)
                  void saveApp({ ...app, preferredUnit: { ...app.preferredUnit, [id]: e.target.value } })
                }}
              >
                {units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <MarkerChart points={a.series.points} unit={a.series.unit} label={marker.name} contextDates={withContext.map(({ p }) => p.date)} events={chartEvents(timeline)} line={shownLine(a, lines)} />
        <ul className="chart-legend">
          <li>
            <span className="legend-swatch range" aria-hidden="true" /> Each lab's own range
          </li>
          <li>
            <span className="legend-swatch flag" aria-hidden="true" /> Outside its range
          </li>
          <li>
            <span className="legend-swatch note" aria-hidden="true" /> Test with notes
          </li>
        </ul>
        {marker.noConversion && <p className="hint">{marker.noConversion.reason}</p>}
        {a.unconverted.length > 0 && (
          <div className="hint">
            {a.unconverted.length === 1 ? "1 result is in a unit LabTrails can't convert" : `${a.unconverted.length} results are in units LabTrails can't convert`} to{' '}
            {a.series.unit}, so {a.unconverted.length === 1 ? "it isn't" : "they aren't"} on the chart. Each is compared with its own range:
            <ul className="plain-list">
              {a.unconverted.map((u) => (
                <li key={u.resultId}>
                  {formatDate(u.date)}: {formatPoint(u)} {u.unit}, {labRange(u.range, 'lab')}
                  {u.flag ? ` · outside the lab's range (${u.flag.side})` : ''}.{' '}
                  <Link to={`${base}/reports/${u.reportId}/results/${u.resultId}`}>Correct the unit</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.series.skipped.some((x) => x.reason === 'not-numeric') && <p className="hint">Results written as text aren't on the chart.</p>}
      </div>

      {(a.change?.notable || a.trend) && (
        <Callout icon={Info}>
          <ul className="plain-list">
            {a.change?.notable && (
              <li>
                From {formatDate(a.change.from.date)} to {formatDate(a.change.to.date)} it went {a.change.direction} by {changeAmount(a).replace(/^[+−]/, '')}
                {a.change.relative !== null && ` (${formatPercent(a.change.relative)})`}.{' '}
                {a.change.crossedRange
                  ? `It moved ${a.latestFlag ? 'outside' : 'back inside'} the lab's range, which always counts as a change.`
                  : `That's at least ${formatPercent(CHANGE_THRESHOLD)} of ${BASIS_WORDS[changeBasis(a.change.to)]}.`}
              </li>
            )}
            {a.trend && (
              <li>
                The last {a.trend.results} results all {a.trend.direction === 'rising' ? 'rose' : 'fell'}, by at least {formatPercent(TREND_THRESHOLD)} of{' '}
                {BASIS_WORDS[changeBasis(a.trend.to)].replace('the previous value', 'the first value')} in total.
              </li>
            )}
          </ul>
          <span className="hint">
            Simple rules, not clinical thresholds. <Link to="/how-flags-work">How flags work</Link>
          </span>
        </Callout>
      )}

      {withContext.length > 0 && (
        <>
          <h2 className="section-title">
            <NotebookPen size={14} aria-hidden /> Notes on these tests
          </h2>
          <div className="card padless">
            <ul className="list">
              {withContext.map(({ p, report }) => (
                <li key={p.resultId} className="list-row">
                  <span className="list-row-main">
                    <span className="list-row-title">{formatDate(p.date)}</span>
                    <span className="list-row-sub">
                      {[
                        report.context?.fasting === 'no' && 'not fasting',
                        ...(report.context?.doseTiming ?? []).map((t) => `drawn ${describeTiming(t, report.date)}`),
                        ...(report.context?.recently ?? []).map((r) => RECENTLY[r]),
                        report.context?.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <YourLine a={a} lines={lines} />

      <KnownInfluences markerId={marker.id} markerName={marker.name} tests={a.series.points.map((p) => reportsById.get(p.reportId)!).filter(Boolean)} timeline={timeline} />

      <h2 className="section-title">All results</h2>
      <ResultsList points={a.series.points} unit={a.series.unit} />
      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}

/**
 * Documented influences on this test (SPEC.md section 18.4), and those the timeline or a test's notes
 * include. Each states a direction and its source; none says why a result is what it is.
 */
function KnownInfluences({ markerId, markerName, tests, timeline }: { markerId: string; markerName: string; tests: Report[]; timeline: TimelineEntry[] }) {
  const known = influencesFor(markerId)
  if (!known.length) return null
  const seen = new Set<string>()
  const matched = tests
    .flatMap((t) => matchInfluences(markerId, timeline, t))
    .filter((m) => {
      const key = `${m.influence.influence}|${m.from.kind === 'timeline' ? m.from.entry.id : m.from.date}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  // "Ferritin" → "ferritin" mid-sentence; "HbA1c", "LDL cholesterol" and "TSH" keep their capitals.
  const name = /^[A-Z][a-z]+(?=\s|$)/.test(markerName) ? markerName.charAt(0).toLowerCase() + markerName.slice(1) : markerName
  return (
    <>
      <h2 className="section-title">
        <Info size={14} aria-hidden /> Things that can affect this test
      </h2>
      <div className="card">
        {matched.length > 0 && (
          <ul className="plain-list influences-matched">
            {matched.map((m, i) => (
              <li key={i}>{matchedSentence(m, name, formatWhen)}</li>
            ))}
          </ul>
        )}
        <ul className="plain-list influences">
          {known.map((k) => (
            <li key={`${k.influence}-${k.effect}`}>
              {k.effect === 'vary'
                ? `It varies with ${lowerFirst(INFLUENCE_NAMES[k.influence])}${k.qualifier ? ` ${k.qualifier}` : ''}.`
                : `${INFLUENCE_NAMES[k.influence]} ${effectWords(k.effect)} it${k.qualifier ? ` ${k.qualifier}` : ''}.`}{' '}
              <a href={k.source.url} target="_blank" rel="noreferrer noopener">
                {k.source.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="hint">Documented influences in general, from health information sites. They don't say why any one result is what it is; your doctor can.</p>
      </div>
    </>
  )
}

const nowIso = () => new Date().toISOString()

/** A line the user or their doctor sets for this marker (SPEC.md section 18.5), in the unit shown. */
function YourLine({ a, lines }: { a: MarkerAnalysis; lines: PersonalLine[] }) {
  const { store, mode, core, saveCore, changed } = useSession()
  const { profile } = useProfileData()
  const existing = lines.find((l) => l.markerId === a.marker.id)
  const shown = existing ? lineIn(existing, a.series.unit) : null
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(existing?.label ?? "My doctor's target")
  const [low, setLow] = useState(shown?.low !== undefined ? formatValue(shown.low) : '')
  const [high, setHigh] = useState(shown?.high !== undefined ? formatValue(shown.high) : '')
  const [error, setError] = useState('')
  // The unit the line's values are typed in: a menu, so a value isn't saved in the wrong unit (LAB-23).
  const units = convertibleUnits(a.marker, a.series.unit)
  const [unit, setUnit] = useState(a.series.unit)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!store) return
    const invalid = validateLine({ label, low, high })
    if (invalid) return setError(invalid)
    const now = nowIso()
    const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined)
    const l = num(low)
    const h = num(high)
    const next: PersonalLine = {
      id: existing?.id ?? crypto.randomUUID(),
      profileId: profile.id,
      markerId: a.marker.id,
      label: label.trim() || 'My line',
      ...(l !== undefined ? { low: l } : {}),
      ...(h !== undefined ? { high: h } : {}),
      unit,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await store.put('lines', next)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    setEditing(false)
    setError('')
  }

  async function remove() {
    if (!store || !existing) return
    await store.delete('lines', existing.id)
    if (mode === 'unlocked') await saveCore({ ...core, changesSinceBackup: core.changesSinceBackup + 1 })
    changed()
    setLow('')
    setHigh('')
  }

  return (
    <>
      <h2 className="section-title">
        <Minus size={14} aria-hidden /> Your line
      </h2>
      <div className="card">
        {editing ? (
          <form className="line-form" onSubmit={save} noValidate>
            <TextField label="What it is" value={label} onChange={(e) => setLabel(e.target.value)} hint="For example “My doctor's target” or “Limit while on medication”." />
            {units.length > 1 && (
              <SelectField label="Unit of the values" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </SelectField>
            )}
            <div className="input-row">
              <TextField label={`Lower value (${unit}, optional)`} inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} />
              <TextField label={`Upper value (${unit}, optional)`} inputMode="decimal" value={high} onChange={(e) => setHigh(e.target.value)} />
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <button className="button primary small">Save the line</button>
              <button type="button" className="button ghost small" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : existing && shown ? (
          <div className="row">
            <span>
              <strong>{shown.label}</strong>: {lineText(shown, formatValue)} {a.series.unit}. <span className="faint">Set by you; the lab's range is shown separately.</span>
            </span>
            <button type="button" className="button small" onClick={() => setEditing(true)}>
              Change
            </button>
            <button type="button" className="button small ghost danger" onClick={() => void remove()}>
              Remove
            </button>
          </div>
        ) : (
          <div className="row">
            <span className="muted">A value you or your doctor want to keep an eye on, drawn on the chart and flagged as yours.</span>
            <button type="button" className="button small" onClick={() => setEditing(true)}>
              Add a line
            </button>
          </div>
        )}
      </div>
    </>
  )
}
