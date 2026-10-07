import { INFLUENCE_NAMES, effectWords, influencesFor, lowerFirst, matchInfluences, matchedSentence } from '../../labs/influences'
import { describeTiming, type TimelineEntry } from '../../labs/timeline'
import type { Report } from '../../labs/types'
import { Info, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { analyseMarker } from '../../labs/analysis'
import { getMarker } from '../../labs/catalogue/catalogue'
import { CHANGE_THRESHOLD, TREND_THRESHOLD } from '../../labs/flags/flags'
import { convertibleUnits } from '../../labs/units/convert'
import { Callout, PageHeader } from '../../core/ui/components'
import { DISCLAIMER, MarkerFlags } from '../components/Flags'
import { chartEvents } from '../chartEvents'
import { MarkerChart, ResultsList } from '../components/MarkerChart'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPercent, formatPoint, formatRange, formatWhen } from '../format'

const RECENTLY: Record<string, string> = { illness: 'recent illness', 'hard-exercise': 'recent hard exercise', alcohol: 'recent alcohol', 'poor-sleep': 'poor sleep' }

export function MarkerDetail() {
  const { id = '' } = useParams()
  const { reports, results, timeline } = useProfileData()
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
        subtitle={a.latest ? `${formatPoint(a.latest)} ${a.series.unit} on ${formatDate(a.latest.date)} · lab's range ${formatRange(a.latest.range)}` : undefined}
        back={{ to: base, label: 'Overview' }}
      />
      <div className="row chips-row">
        <MarkerFlags a={a} />
      </div>

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
        <MarkerChart points={a.series.points} unit={a.series.unit} label={marker.name} contextDates={withContext.map(({ p }) => p.date)} events={chartEvents(timeline)} />
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
        {a.series.skipped.length > 0 && (
          <p className="hint">
            {a.series.skipped.length} result{a.series.skipped.length > 1 ? 's' : ''} can't be shown in {a.series.unit}.
          </p>
        )}
      </div>

      {(a.change?.notable || a.trend) && (
        <Callout icon={Info}>
          <ul className="plain-list">
            {a.change?.notable && (
              <li>
                From {formatDate(a.change.from.date)} to {formatDate(a.change.to.date)} it went {a.change.direction}
                {a.change.relative !== null && ` by ${formatPercent(a.change.relative)}`}.{' '}
                {a.change.crossedRange ? "It moved into or out of the lab's range, which always counts as a change." : `That's at least ${formatPercent(CHANGE_THRESHOLD)} of the lab's range width.`}
              </li>
            )}
            {a.trend && (
              <li>
                The last {a.trend.results} results all {a.trend.direction === 'rising' ? 'rose' : 'fell'}, by at least {formatPercent(TREND_THRESHOLD)} of the range width in total.
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
  const name = markerName.charAt(0).toLowerCase() + markerName.slice(1)
  return (
    <>
      <h2 className="section-title">
        <Info size={14} aria-hidden /> Things known to affect this test
      </h2>
      <div className="card">
        {matched.length > 0 && (
          <ul className="plain-list influences-matched">
            {matched.map((m, i) => (
              <li key={i}>{matchedSentence(m, /^[A-Z]{2}/.test(markerName) ? markerName : name, formatWhen)}</li>
            ))}
          </ul>
        )}
        <ul className="plain-list influences">
          {known.map((k) => (
            <li key={`${k.influence}-${k.effect}`}>
              {k.effect === 'vary' ? `It varies with ${lowerFirst(INFLUENCE_NAMES[k.influence])}.` : `${INFLUENCE_NAMES[k.influence]} ${effectWords(k.effect)} it.`}{' '}
              <a href={k.source.url} target="_blank" rel="noreferrer noopener">
                {k.source.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="hint">Documented influences in general, from public health sources. They don't say why any one result is what it is; your doctor can.</p>
      </div>
    </>
  )
}
