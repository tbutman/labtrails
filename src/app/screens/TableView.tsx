import { Link } from 'react-router'
import { analyse } from '../../labs/analysis'
import { rangeFlag } from '../../labs/flags/flags'
import { entryLabel, firstDay, lastDay, startedBetween, type TimelineEntry } from '../../labs/timeline'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { PageHeader } from '../../core/ui/components'
import { formatDate, formatPoint } from '../format'

export function TableView() {
  const { reports, results, timeline } = useProfileData()
  const { app } = useSession()
  const panels = analyse(results, reports, app.preferredUnit)
  const dates = [...new Set(reports.map((r) => r.date))].sort().reverse()

  return (
    <>
      <PageHeader title="All results" subtitle={<>Every marker by date, newest first. <span className="chip flag">! Outside the lab's range</span></>} />
      <div className="table-wrap" tabIndex={0} aria-label="Results table, scrolls sideways">
        <table>
          <thead>
            <tr>
              <th scope="col">Marker</th>
              {dates.map((d) => (
                <th key={d} scope="col">
                  {formatDate(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.length > 0 && <TimelineRow timeline={timeline} dates={dates} />}
            {panels.map((panel) => (
              <PanelRows key={panel.id} name={panel.name} markers={panel.markers} dates={dates} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** What started or ended since the test before each one. Dates are newest first. */
function TimelineRow({ timeline, dates }: { timeline: TimelineEntry[]; dates: string[] }) {
  const base = useBase()
  return (
    <tr className="timeline-row">
      <th scope="row">
        <Link to={`${base}/timeline`}>Timeline</Link>
      </th>
      {dates.map((d, i) => {
        const after = dates[i + 1]
        const started = startedBetween(timeline, after, d)
        const ended = timeline.filter((e) => e.end && lastDay(e.end) <= d && (after === undefined || lastDay(e.end) > after))
        return (
          <td key={d}>
            {started.map((e) => (
              <div key={`s${e.id}`} className="timeline-cell">
                Started {entryLabel(e)} <span className="faint">({formatDate(firstDay(e.start))})</span>
              </div>
            ))}
            {ended.map((e) => (
              <div key={`e${e.id}`} className="timeline-cell">
                Ended {e.name}
              </div>
            ))}
          </td>
        )
      })}
    </tr>
  )
}

function PanelRows({ name, markers, dates }: { name: string; markers: ReturnType<typeof analyse>[number]['markers']; dates: string[] }) {
  const base = useBase()
  return (
    <>
      <tr className="panel-row">
        <th scope="rowgroup" colSpan={dates.length + 1}>
          {name}
        </th>
      </tr>
      {markers.map((a) => (
        <tr key={a.marker.id}>
          <th scope="row">
            <Link to={`${base}/marker/${a.marker.id}`}>{a.marker.name}</Link> <span className="faint unit-label">{a.series.unit}</span>
          </th>
          {dates.map((d) => {
            const p = a.series.points.find((x) => x.date === d)
            const f = p && rangeFlag(p)
            return (
              <td key={d} className={f ? 'flagged' : undefined}>
                {p ? (
                  <>
                    {f && <span aria-hidden="true">! </span>}
                    {formatPoint(p)}
                    {f && <span className="sr-only"> (outside the lab's range, {f.side})</span>}
                  </>
                ) : (
                  <span className="muted">–</span>
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
