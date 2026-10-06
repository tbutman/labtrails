import { useState, type FormEvent } from 'react'
import { WrongPassphraseError } from '../../core'
import { BackupError, backupFileName, exportBackup, readBackup, restoreBackup } from '../../core/backup/backup'
import { Field } from '../components/Field'
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
    <div>
      <p>
        A backup is one file with all your results, still encrypted. Your passphrase opens it. Keep it somewhere other than this device, such
        as your cloud storage or email, because clearing this browser's data deletes everything here.
      </p>
      <p className="hint">
        {core.lastBackupAt ? `Last backup: ${new Date(core.lastBackupAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}.` : 'No backup yet.'}
      </p>
      <button className="button" onClick={() => void download()} disabled={busy}>
        {busy ? 'Preparing…' : 'Download a backup'}
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
      <p>Choose a LabTrails backup file and enter the passphrase it was made with. It replaces anything already on this device.</p>
      <Field label="Backup file" htmlFor="backup-file">
        <input id="backup-file" type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="The backup's passphrase" htmlFor="backup-passphrase">
        <input id="backup-passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button secondary" disabled={busy || !passphrase}>
        {busy ? 'Restoring…' : 'Restore'}
      </button>
    </form>
  )
}
