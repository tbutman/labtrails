import { CircleAlert, FilePlus2, FileSearch, HelpCircle, ScanText } from 'lucide-react'
import { Link } from 'react-router'
import { analyse, unmapped, type MarkerAnalysis } from '../../labs/analysis'
import { Callout, EmptyState, MetricCard, PageHeader, Sparkline } from '../../core/ui/components'
import { DISCLAIMER, MarkerFlags } from '../components/Flags'
import { sparkPoints } from '../spark'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPoint, formatRange, plural } from '../format'

function Metric({ a, base }: { a: MarkerAnalysis; base: string }) {
  const latest = a.latest
  return (
    <MetricCard
      to={`${base}/marker/${a.marker.id}`}
      label={a.marker.name}
      value={latest ? formatPoint(latest) : '—'}
      unit={latest ? a.series.unit : undefined}
      chips={<MarkerFlags a={a} compact />}
      foot={latest ? `Lab's range ${formatRange(latest.range)} · ${formatDate(latest.date)}` : undefined}
    >
      <Sparkline points={sparkPoints(a)} />
    </MetricCard>
  )
}

export function Overview() {
  const { profile, reports, results } = useProfileData()
  const base = useBase()
  const { app, mode } = useSession()
  const panels = analyse(results, reports, app.preferredUnit)
  const all = panels.flatMap((p) => p.markers)
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const flagged = all.filter((m) => m.latestFlag || m.change?.notable || m.trend)
  const unknown = [...new Set(unmapped(results).map((r) => r.nameAsPrinted))]

  const actions = (
    <>
      <Link className="button" to={`${base}/reports/read`}>
        <ScanText size={16} aria-hidden /> Read a report
      </Link>
      {mode === 'unlocked' && (
        <Link className="button primary" to={`${base}/reports/new`}>
          <FilePlus2 size={16} aria-hidden /> Add results
        </Link>
      )}
    </>
  )

  if (reports.length === 0)
    return (
      <>
        <PageHeader title={profile.name} subtitle="No results yet." />
        <EmptyState icon={FileSearch} title="Add your first report" action={<div className="row">{actions}</div>}>
          Read a lab report with AI and check every row, or type the results in as printed.
        </EmptyState>
      </>
    )

  return (
    <>
      <PageHeader title={profile.name} subtitle={latest && `Latest test ${formatDate(latest.date)}${latest.lab ? ` · ${latest.lab}` : ''}`} actions={actions} />

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{reports.length}</div>
          <div className="stat-label">{reports.length === 1 ? 'Report' : 'Reports'}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{all.length}</div>
          <div className="stat-label">Markers tracked</div>
        </div>
        <div className="stat">
          <div className="stat-value">{flagged.length}</div>
          <div className="stat-label">{flagged.length === 1 ? 'Has a flag' : 'Have a flag'}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{latest ? formatDate(latest.date).replace(/ \d{4}$/, '') : '—'}</div>
          <div className="stat-label">Latest test</div>
        </div>
      </div>

      {flagged.length > 0 && (
        <>
          <h2 className="section-title">
            <CircleAlert size={14} aria-hidden /> Worth discussing · {plural(flagged.length, 'marker')}
          </h2>
          <div className="metric-grid">
            {flagged.map((a) => (
              <Metric key={a.marker.id} a={a} base={base} />
            ))}
          </div>
        </>
      )}

      {panels.map((panel) => (
        <section key={panel.id} aria-labelledby={`panel-${panel.id}`}>
          <h2 className="section-title" id={`panel-${panel.id}`}>
            {panel.name}
          </h2>
          <div className="metric-grid">
            {panel.markers.map((a) => (
              <Metric key={a.marker.id} a={a} base={base} />
            ))}
          </div>
        </section>
      ))}

      {unknown.length > 0 && (
        <>
          <h2 className="section-title">Not in the catalogue</h2>
          <Callout icon={HelpCircle}>
            Kept exactly as printed: {unknown.join(', ')}. You can map a name to a marker when you next add a report.
          </Callout>
        </>
      )}

      <p className="hint disclaimer">{DISCLAIMER}</p>
    </>
  )
}
