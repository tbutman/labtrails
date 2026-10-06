import { Link } from 'react-router'
import { analyse } from '../../labs/analysis'
import { rangeFlag } from '../../labs/flags/flags'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPoint } from '../format'

export function TableView() {
  const { reports, results } = useProfileData()
  const { app } = useSession()
  const panels = analyse(results, reports, app.preferredUnit)
  const dates = [...new Set(reports.map((r) => r.date))].sort().reverse()

  return (
    <>
      <h1>All markers by date</h1>
      <p className="muted small">
        Newest first. Values are shown in each marker's display unit. <span className="flag range">! Outside the lab's range</span>
      </p>
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
            {panels.map((panel) => (
              <PanelRows key={panel.id} name={panel.name} markers={panel.markers} dates={dates} />
            ))}
          </tbody>
        </table>
      </div>
    </>
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
            <Link to={`${base}/marker/${a.marker.id}`}>{a.marker.name}</Link> <span className="muted small">{a.series.unit}</span>
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
