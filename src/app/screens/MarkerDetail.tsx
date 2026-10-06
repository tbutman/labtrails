import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { analyseMarker } from '../../labs/analysis'
import { getMarker } from '../../labs/catalogue/catalogue'
import { CHANGE_THRESHOLD, TREND_THRESHOLD } from '../../labs/flags/flags'
import { convertibleUnits } from '../../labs/units/convert'
import { DISCLAIMER, MarkerFlags } from '../components/Flags'
import { MarkerChart, ResultsList } from '../components/MarkerChart'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPercent } from '../format'

const RECENTLY: Record<string, string> = { illness: 'illness', 'hard-exercise': 'hard exercise', alcohol: 'alcohol', 'poor-sleep': 'poor sleep' }

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
        <h1>Marker not found</h1>
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
      <p className="small">
        <Link to={base}>← Overview</Link>
      </p>
      <h1>{marker.name}</h1>
      <p className="context-list">
        <MarkerFlags a={a} />
      </p>

      <section className="card">
        {units.length > 1 && (
          <div className="unit-switch">
            <label htmlFor="unit">Show in</label>
            <select id="unit" value={a.series.unit} onChange={(e) => {
                setUnit(e.target.value)
                void saveApp({ ...app, preferredUnit: { ...app.preferredUnit, [id]: e.target.value } })
              }}>
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        )}
        <MarkerChart points={a.series.points} unit={a.series.unit} label={marker.name} contextDates={withContext.map(({ p }) => p.date)} />
        <p className="muted small">
          Each pale bar is that lab's own range. A ring with "!" marks a result outside its range. A dot under the axis marks a test with
          notes (not fasting, recent illness or exercise).
        </p>
        {marker.noConversion && <p className="small">{marker.noConversion.reason}</p>}
        {a.series.skipped.length > 0 && (
          <p className="small muted">
            {a.series.skipped.length} result{a.series.skipped.length > 1 ? 's' : ''} can't be shown in {a.series.unit}.
          </p>
        )}
      </section>

      {(a.change?.notable || a.trend) && (
        <section>
          <h2>What the flags mean here</h2>
          <ul>
            {a.change?.notable && (
              <li>
                From {formatDate(a.change.from.date)} to {formatDate(a.change.to.date)} it went {a.change.direction}
                {a.change.relative !== null && ` by ${formatPercent(a.change.relative)}`}.
                {a.change.crossedRange
                  ? ' It moved into or out of the lab\'s range, which always counts as a change.'
                  : ` That's at least ${formatPercent(CHANGE_THRESHOLD)} of the lab's range width.`}
              </li>
            )}
            {a.trend && (
              <li>
                The last {a.trend.results} results all {a.trend.direction === 'rising' ? 'rose' : 'fell'}, by at least {formatPercent(TREND_THRESHOLD)} of
                the range width in total.
              </li>
            )}
          </ul>
          <p className="small muted">
            These are simple rules, not clinical thresholds. <Link to="/how-flags-work">How flags work</Link>
          </p>
        </section>
      )}

      {withContext.length > 0 && (
        <section>
          <h2>Notes on these tests</h2>
          <ul>
            {withContext.map(({ p, report }) => (
              <li key={p.resultId}>
                {formatDate(p.date)}:{' '}
                {[
                  report.context?.fasting === 'no' && 'not fasting',
                  ...(report.context?.recently ?? []).map((r) => `recent ${RECENTLY[r]}`),
                  report.context?.notes,
                ]
                  .filter(Boolean)
                  .join('; ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>All results</h2>
      <ResultsList points={a.series.points} unit={a.series.unit} />
      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  )
}
