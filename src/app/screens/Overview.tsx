import { CircleAlert, ClipboardCheck, FilePlus2, FileSearch, HelpCircle, ListX, ScanText, TrendingUp, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { analyse, notRepeated, unmapped, type MarkerAnalysis } from '../../labs/analysis'
import { Callout, EmptyState, MetricCard, PageHeader, Sparkline } from '../../core/ui/components'
import { CRITICAL_TEXT, CRITICAL_TEXT_MANY, DISCLAIMER, MarkerFlags, labMarkText } from '../components/Flags'
import type { PersonalLine } from '../../labs/lines'
import { personalFlag } from '../personalLine'
import { sparkPoints } from '../spark'
import { useBase, useProfileData } from '../profileContext'
import { useSession } from '../sessionContext'
import { formatDate, formatPoint, formatRange, plural } from '../format'

function Metric({ a, base, lines }: { a: MarkerAnalysis; base: string; lines: PersonalLine[] }) {
  const latest = a.latest
  const line = personalFlag(a, lines)
  return (
    <MetricCard
      to={`${base}/marker/${a.marker.id}`}
      label={a.marker.name}
      value={latest ? formatPoint(latest) : '—'}
      unit={latest ? a.series.unit : undefined}
      chips={<MarkerFlags a={a} compact line={line} />}
      foot={latest ? [`Lab's range ${formatRange(latest.range)}`, labMarkText(latest.flagAsPrinted), formatDate(latest.date)].filter(Boolean).join(' · ') : undefined}
    >
      <Sparkline points={sparkPoints(a)} />
    </MetricCard>
  )
}

export function Overview() {
  const { profile, reports, results, lines } = useProfileData()
  const base = useBase()
  const { app, mode } = useSession()
  const panels = analyse(results, reports, app.preferredUnit)
  const all = panels.flatMap((p) => p.markers)
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const flagged = all.filter((m) => m.latestFlag || m.change?.notable || m.trend)
  const outside = flagged.filter((m) => m.latestFlag)
  const inside = flagged.filter((m) => !m.latestFlag)
  const critical = all.filter((m) => m.latestCritical)
  const missing = notRepeated(results, reports)
  const unknown = [...new Set(unmapped(results).map((r) => r.nameAsPrinted))]

  const actions = (
    <>
      <Link className="button" to={`${base}/reports/read`}>
        <ScanText size={16} aria-hidden /> Import reports
      </Link>
      <Link className="button ghost" to={`${base}/next-test`}>
        <ClipboardCheck size={16} aria-hidden /> Before your next test
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
          Import PDFs, photos or a zip of reports and check every row, or type the results in as printed.
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
          <div className="stat-value">{latest ? formatDate(latest.date).replace(/,? \d{4}$/, '') : '—'}</div>
          <div className="stat-label">Latest test</div>
        </div>
      </div>

      {critical.length > 0 && (
        <Callout icon={TriangleAlert} tone="warning">
          <strong>Far outside the lab's range or marked critical by the lab:</strong>{' '}
          {critical.map((m, i) => (
            <span key={m.marker.id}>
              {i > 0 && ', '}
              <Link to={`${base}/marker/${m.marker.id}`}>{m.marker.name}</Link>{' '}
              <span className="faint">
                ({formatPoint(m.latest!)} {m.series.unit}, {formatDate(m.latest!.date)})
              </span>
            </span>
          ))}
          . {critical.length === 1 ? CRITICAL_TEXT : CRITICAL_TEXT_MANY}
        </Callout>
      )}

      {outside.length > 0 && (
        <>
          <h2 className="section-title">
            <CircleAlert size={14} aria-hidden /> Outside the lab's range · {plural(outside.length, 'marker')}
          </h2>
          <div className="metric-grid">
            {outside.map((a) => (
              <Metric key={a.marker.id} a={a} base={base} lines={lines} />
            ))}
          </div>
        </>
      )}
      {inside.length > 0 && (
        <>
          <h2 className="section-title">
            <TrendingUp size={14} aria-hidden /> Changed or trending inside the range · {plural(inside.length, 'marker')}
          </h2>
          <div className="metric-grid">
            {inside.map((a) => (
              <Metric key={a.marker.id} a={a} base={base} lines={lines} />
            ))}
          </div>
        </>
      )}

      {missing.length > 0 && (
        <Callout icon={ListX}>
          <strong>Not in your latest report:</strong>{' '}
          {missing.map((m, i) => (
            <span key={m.markerId}>
              {i > 0 && ', '}
              <Link to={`${base}/marker/${m.markerId}`}>{m.name}</Link> <span className="faint">(last {formatDate(m.lastDate)})</span>
            </span>
          ))}
          . Worth asking about if you'd like them followed.
        </Callout>
      )}

      {panels.map((panel) => (
        <section key={panel.id} aria-labelledby={`panel-${panel.id}`}>
          <h2 className="section-title" id={`panel-${panel.id}`}>
            {panel.name}
          </h2>
          <div className="metric-grid">
            {panel.markers.map((a) => (
              <Metric key={a.marker.id} a={a} base={base} lines={lines} />
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
