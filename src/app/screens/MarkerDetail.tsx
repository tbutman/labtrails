import { Info, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { analyseMarker } from '../../labs/analysis'
import { getMarker } from '../../labs/catalogue/catalogue'
import { CHANGE_THRESHOLD, TREND_THRESHOLD } from '../../labs/flags/flags'
import { convertibleUnits } from '../../labs/units/convert'
import { Callout, PageHeader } from '../../trails-ui/components'
import { DISCLAIMER, MarkerFlags } from '../components/Flags'
import { MarkerChart, ResultsList } from '../components/MarkerChart'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPercent, formatPoint, formatRange } from '../format'

const RECENTLY: Record<string, string> = { illness: 'recent illness', 'hard-exercise': 'recent hard exercise', alcohol: 'recent alcohol', 'poor-sleep': 'poor sleep' }

export function MarkerDetail() {
  const { id = '' } = useParams()
  const { reports, results } = useProfileData()
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
    .filter(({ report }) => report.context && (report.context.fasting === 'no' || report.context.recently?.length || report.context.notes))

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
        <MarkerChart points={a.series.points} unit={a.series.unit} label={marker.name} contextDates={withContext.map(({ p }) => p.date)} />
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
                      {[report.context?.fasting === 'no' && 'not fasting', ...(report.context?.recently ?? []).map((r) => RECENTLY[r]), report.context?.notes].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2 className="section-title">All results</h2>
      <ResultsList points={a.series.points} unit={a.series.unit} />
      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}
