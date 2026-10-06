import { DISCLAIMER } from '../components/Flags'
import { SafeMarkdown } from '../components/SafeMarkdown'
import { useProfileData } from '../profileContext'
import { formatDate } from '../format'

export function Summaries() {
  const { summaries, reports } = useProfileData()
  const ordered = [...summaries].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'after-report' ? -1 : 1))
  return (
    <>
      <h1>Summaries</h1>
      <p className="muted">
        With your own API key, LabTrails can ask an AI to explain what changed. It only explains what the code flagged; it doesn't add flags,
        diagnose or suggest treatment. In the demo these are pre-written examples.
      </p>
      {ordered.map((s) => {
        const report = s.reportId ? reports.find((r) => r.id === s.reportId) : undefined
        return (
          <article key={s.id} className="card panel ai">
            <span className="ai-label">AI-written summary · example for the demo</span>
            <h2 className="flush">{s.kind === 'after-report' ? `After the ${report ? formatDate(report.date) : 'latest'} report` : 'Overall'}</h2>
            <SafeMarkdown text={s.text} />
            <p className="disclaimer">{DISCLAIMER}</p>
          </article>
        )
      })}
    </>
  )
}
