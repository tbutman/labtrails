import { Download, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { WrongPassphraseError } from '../../core'
import { BackupError, backupFileName, exportBackup, readBackup, restoreBackup } from '../../core/backup/backup'
import { FileDrop, TextField } from '../../core/ui/components'
import { useSession } from '../sessionContext'
import { APP_ID } from '../types'

export function ExportBackup() {
  const { trails, core, saveCore, mode } = useSession()
  const [busy, setBusy] = useState(false)
  if (mode !== 'unlocked' || !trails) return null

  async function download() {
    if (!trails) return
    setBusy(true)
    try {
      const blob = await exportBackup(trails.db, APP_ID)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName(APP_ID)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await saveCore({ ...core, lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="spread wrap">
      <div>
        <p className="muted small">
          One file with all your results, still encrypted; your passphrase opens it. Keep it somewhere other than this device, because clearing this
          browser's data deletes everything here.
        </p>
        <p className="hint">
          {core.lastBackupAt ? `Last backup: ${new Date(core.lastBackupAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}.` : 'No backup yet.'}
        </p>
      </div>
      <button className="button primary" onClick={() => void download()} disabled={busy}>
        <Download size={16} aria-hidden /> {busy ? 'Preparing…' : 'Download a backup'}
      </button>
    </div>
  )
}

export function RestoreBackup() {
  const { trails, reload, lock } = useSession()
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trails || !file) return setError('Choose a backup file first.')
    setBusy(true)
    setError('')
    try {
      const backup = await readBackup(file, APP_ID)
      if ((await trails.vault.exists()) && !window.confirm('This replaces everything on this device with the backup. Continue?')) return
      lock()
      await restoreBackup(trails.db, backup, passphrase)
      setDone(true)
      await reload()
    } catch (err) {
      setError(err instanceof WrongPassphraseError || err instanceof BackupError ? err.message : 'The backup could not be restored.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p role="status">Restored. Unlock with the backup's passphrase.</p>

  return (
    <form onSubmit={submit} noValidate>
      <p className="muted small">Choose a LabTrails backup and enter the passphrase it was made with. It replaces anything already on this device.</p>
      <div className="field">
        <FileDrop label={file ? file.name : 'Choose a backup file'} hint="A .json file from LabTrails" accept=".json,application/json" icon={Upload} onFile={setFile} />
      </div>
      <TextField label="The backup's passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} error={error} />
      <button className="button primary block" disabled={busy || !passphrase}>
        {busy ? 'Restoring…' : 'Restore'}
      </button>
    </form>
  )
}
