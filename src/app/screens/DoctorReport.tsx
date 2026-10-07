import { Download, Printer, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Checkbox, ChipGroup, PageHeader, TextAreaField } from '../../core/ui/components'
import { analyse, notRepeated, type MarkerAnalysis } from '../../labs/analysis'
import { activeBetween, entryLabel, sortByStart, type TimelineEntry } from '../../labs/timeline'
import { useProfileData } from '../profileContext'
import { ReportSheet, ReportTable, SHEET_WIDTH, reportHeader, reportRows } from '../report/ReportSheet'
import { ageInYears } from '../../labs/person'
import { formatPeriod } from '../format'
import { useSession } from '../sessionContext'
import { useLeaveWarning } from '../returnTo'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + '.')
    .join(' ')
}

/** Entries active between the first result shown and the latest test, oldest first. */
function timelineFor(timeline: TimelineEntry[], markers: MarkerAnalysis[], latest: string | undefined): string[] {
  const first = markers.flatMap((a) => a.series.points.map((p) => p.date)).sort()[0]
  if (!first || !latest) return []
  return sortByStart(activeBetween(timeline, first, latest)).map((e) => `${entryLabel(e)} (${formatPeriod(e.start, e.end)})`)
}

export function DoctorReport() {
  const { profile, reports, results, timeline, lines } = useProfileData()
  const { app } = useSession()
  const all = analyse(results, reports, app.preferredUnit).flatMap((p) => p.markers)
  // By default: results outside the lab's range, and trends (LAB-11). The person can add any other marker.
  const flagged = all.filter((a) => a.latestFlag || a.trend).map((a) => a.marker.id)
  const [selected, setSelected] = useState<string[]>(flagged)
  const [useInitials, setUseInitials] = useState(false)
  const [withAgeSex, setWithAgeSex] = useState(true)
  // Medications and lifestyle are sensitive: off unless the user ticks it (SPEC.md section 18.8).
  const [withTimeline, setWithTimeline] = useState(false)
  const [notes, setNotes] = useState('')
  // The notes aren't saved, so closing the page with some typed asks first (X-05).
  useLeaveWarning(!!notes.trim())
  const [status, setStatus] = useState('')
  const sheet = useRef<HTMLDivElement>(null)
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const markers = all.filter((a) => selected.includes(a.marker.id))
  const who = useInitials ? initials(profile.name) : profile.name
  const today = new Date().toISOString().slice(0, 10)
  // Age and sex help a doctor read the ranges; optional, and never with initials (LAB-16).
  const person =
    withAgeSex && !useInitials && (profile.dateOfBirth || profile.sex)
      ? { ...(profile.dateOfBirth ? { age: ageInYears(profile.dateOfBirth, today) } : {}), ...(profile.sex ? { sex: profile.sex } : {}) }
      : undefined
  const fileName = `labtrails-doctor-report-${latest?.date ?? 'results'}.png`

  async function png(): Promise<Blob> {
    const svg = sheet.current?.querySelector('svg')
    if (!svg) throw new Error('No report')
    const source = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = SHEET_WIDTH * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'))
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function download() {
    const blob = await png()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function share() {
    const file = new File([await png()], fileName, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Doctor report' })
      } catch {
        // The user closed the share sheet.
      }
    } else {
      setStatus("This browser can't share files directly, so the image was downloaded instead.")
      await download()
    }
  }

  return (
    <>
      <div className="no-print">
        <PageHeader title="Doctor report" subtitle="One page to print or share. It's a file you share yourself; nothing is uploaded." />
        <div className="card">
          <ChipGroup legend="Markers to include" options={all.map((a) => ({ value: a.marker.id, label: a.marker.name }))} value={selected} onChange={setSelected} />
          <Checkbox checked={useInitials} onChange={setUseInitials}>
            Show initials instead of the name
          </Checkbox>
          {(profile.dateOfBirth || profile.sex) && !useInitials && (
            <Checkbox checked={withAgeSex} onChange={setWithAgeSex}>
              Show age and sex
            </Checkbox>
          )}
          {timeline.length > 0 && (
            <Checkbox checked={withTimeline} onChange={setWithTimeline}>
              Include the timeline (medications, supplements and changes during these results)
            </Checkbox>
          )}
          <TextAreaField label="Your notes and questions (optional, not saved)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="row">
            <button className="button primary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden /> Print or save as PDF
            </button>
            <button className="button" onClick={() => void download()}>
              <Download size={16} aria-hidden /> Download image
            </button>
            <button className="button" onClick={() => void share()}>
              <Share2 size={16} aria-hidden /> Share
            </button>
          </div>
          {status && (
            <p className="hint form-error" role="status">
              {status}
            </p>
          )}
        </div>
      </div>
      <div className="report-sheet" ref={sheet}>
        <ReportSheet
          who={who}
          markers={markers}
          reports={reports}
          latest={latest}
          notes={notes}
          missing={notRepeated(results, reports)}
          timeline={withTimeline ? timelineFor(timeline, markers, latest?.date) : []}
          lines={lines}
          preparedOn={today}
          person={person}
          describedBy="report-table"
        />
      </div>
      <ReportTable id="report-table" who={who} header={reportHeader(reports, today, person)} rows={reportRows(markers, reports, lines)} />
    </>
  )
}
