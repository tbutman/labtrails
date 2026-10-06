import { Download, Printer, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Checkbox, ChipGroup, PageHeader, TextAreaField } from '../../trails-ui/components'
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
        <PageHeader title="Report for your doctor" subtitle="One page to print or share. It's a file you share yourself; nothing is uploaded." />
        <div className="card">
          <ChipGroup legend="Markers to include" options={all.map((a) => ({ value: a.marker.id, label: a.marker.name }))} value={selected} onChange={setSelected} />
          <Checkbox checked={useInitials} onChange={setUseInitials}>
            Show initials instead of the name
          </Checkbox>
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
        <ReportSheet who={who} markers={markers} latest={latest} notes={notes} />
      </div>
    </>
  )
}
