import { useRef, useState } from 'react'
import { analyse } from '../../labs/analysis'
import { useProfileData } from '../profileContext'
import { ReportSheet, SHEET_WIDTH } from '../report/ReportSheet'
import { useSession } from '../sessionContext'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + '.')
    .join(' ')
}

export function DoctorReport() {
  const { profile, reports, results } = useProfileData()
  const { app } = useSession()
  const all = analyse(results, reports, app.preferredUnit).flatMap((p) => p.markers)
  const flagged = all.filter((a) => a.latestFlag || a.change?.notable || a.trend).map((a) => a.marker.id)
  const [selected, setSelected] = useState<string[]>(flagged)
  const [useInitials, setUseInitials] = useState(false)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const sheet = useRef<HTMLDivElement>(null)
  const latest = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const markers = all.filter((a) => selected.includes(a.marker.id))
  const who = useInitials ? initials(profile.name) : profile.name
  const fileName = `labtrails-report-${latest?.date ?? 'results'}.png`

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
        await navigator.share({ files: [file], title: 'Lab results' })
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
        <h1>Report for your doctor</h1>
        <p>One page with the markers you choose, their trends and your notes. It's a file you print or share yourself; nothing is uploaded.</p>
        <fieldset className="choices">
          <legend>Markers to include</legend>
          {all.map((a) => (
            <label key={a.marker.id} className="check">
              <input type="checkbox" checked={selected.includes(a.marker.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, a.marker.id] : s.filter((x) => x !== a.marker.id)))} />
              <span>{a.marker.name}</span>
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={useInitials} onChange={(e) => setUseInitials(e.target.checked)} />
          <span>Show initials instead of the name</span>
        </label>
        <div className="field">
          <label htmlFor="report-notes">Your notes and questions (optional, not saved)</label>
          <textarea id="report-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <p className="row">
          <button className="button primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button className="button" onClick={() => void download()}>
            Download as image
          </button>
          <button className="button" onClick={() => void share()}>
            Share…
          </button>
        </p>
        {status && <p className="hint" role="status">{status}</p>}
      </div>
      <div className="report-sheet" ref={sheet}>
        <ReportSheet who={who} markers={markers} latest={latest} notes={notes} />
      </div>
    </>
  )
}
