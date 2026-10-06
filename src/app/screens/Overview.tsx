import { Link } from 'react-router'
import { analyse, unmapped } from '../../labs/analysis'
import { DISCLAIMER, MarkerFlags } from '../components/Flags'
import { useProfileData } from '../profileContext'
import { formatDate, formatPoint, formatRange } from '../format'

export function Overview() {
  const { profile, reports, results } = useProfileData()
  const panels = analyse(results, reports)
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const flagged = panels.flatMap((p) => p.markers).filter((m) => m.latestFlag || m.change?.notable || m.trend)
  const unknown = [...new Set(unmapped(results).map((r) => r.nameAsPrinted))]

  return (
    <>
      <h1>{profile.name}</h1>
      <p className="muted">
        {reports.length} reports{latest && `, latest ${formatDate(latest.date)}`}. {flagged.length} markers have a flag.
      </p>

      {panels.map((panel) => (
        <section key={panel.id} className="card panel" aria-labelledby={`panel-${panel.id}`}>
          <h2 id={`panel-${panel.id}`} className="flush">
            {panel.name}
          </h2>
          <ul className="marker-list">
            {panel.markers.map((a) => (
              <li key={a.marker.id}>
                <Link className="marker-row" to={`/demo/marker/${a.marker.id}`}>
                  <span className="marker-name">{a.marker.name}</span>
                  <span className="marker-value">
                    {a.latest ? (
                      <>
                        <strong>{formatPoint(a.latest)}</strong> {a.series.unit}
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                  <span className="marker-meta">
                    <span className="muted small">Lab's range {formatRange(a.latest?.range)}</span>
                    <MarkerFlags a={a} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {unknown.length > 0 && (
        <section className="card panel">
          <h2 className="flush">Not in the catalogue</h2>
          <p className="muted small">Kept exactly as printed. You'll be able to map them to a marker, or leave them as they are.</p>
          <ul>
            {unknown.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  )
}
