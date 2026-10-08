// Downloading a backup and restoring one (CORE-03), shared by both apps. A restore checks the
// passphrase and every record first, and only then locks the vault and replaces what's here, so a
// wrong passphrase changes nothing and its error stays on screen.

import { Download, FileArchive } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatDate } from '../format'
import type { Db } from '../store/db'
import { FileDrop, TextField } from '../ui/components'
import { WrongPassphraseError, type Vault } from '../vault/vault'
import { BackupError, backupFileName, exportBackup, readBackup, replaceWithBackup, verifyBackup } from './backup'

export function ExportBackup({
  db,
  appId,
  contents = 'everything, including documents',
  lastBackupAt,
  onExported,
}: {
  db: Db
  appId: string
  /** What the file holds, after "One file with": "everything, including documents". */
  contents?: string
  lastBackupAt?: string
  /** Record the backup (lastBackupAt, changesSinceBackup) in the app's settings. */
  onExported: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const blob = await exportBackup(db, appId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName(appId)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await onExported()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p>
        One file with {contents}, still encrypted. Your passphrase opens it. Keep it somewhere other than this device, such as your cloud
        storage or email.
      </p>
      <p className="hint">The backup includes your settings and AI key, still encrypted.</p>
      <p className="hint">{lastBackupAt ? `Last backup: ${formatDate(lastBackupAt)}.` : 'No backup yet.'}</p>
      <div>
        <button className="button primary" onClick={() => void download()} disabled={busy}>
          <Download size={16} aria-hidden /> {busy ? 'Preparing…' : 'Download a backup'}
        </button>
      </div>
    </div>
  )
}

export function RestoreBackup({
  db,
  vault,
  appId,
  appName,
  intro = true,
  onRestored,
}: {
  db: Db
  vault: Vault
  appId: string
  appName: string
  /** The line saying what to choose; leave it out where the page already says it. */
  intro?: boolean
  /** The vault is locked and holds the backup: show the Unlock form, with "Restored. …". */
  onRestored: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return setError('Choose a backup file first.')
    setBusy(true)
    setError('')
    try {
      const backup = await readBackup(file, appId)
      await verifyBackup(backup, passphrase)
      if ((await vault.exists()) && !window.confirm('This replaces everything on this device with the backup. Continue?')) return
      vault.lock()
      await replaceWithBackup(db, backup)
      onRestored()
    } catch (err) {
      setError(
        err instanceof WrongPassphraseError ? "That passphrase doesn't open this backup." : err instanceof BackupError ? err.message : 'The backup could not be restored.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {intro && <p className="hint">Choose a {appName} backup and enter the passphrase it was made with. It replaces anything already on this device.</p>}
      <FileDrop label={file ? file.name : 'Choose a backup file'} hint={`A .json file made by ${appName}`} accept=".json,application/json" icon={FileArchive} onFile={setFile} />
      <TextField label="The backup's passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} error={error} />
      <button className="button primary block" type="submit" disabled={busy || !file || !passphrase}>
        {busy ? 'Checking…' : 'Restore'}
      </button>
    </form>
  )
}

/** The message over the Unlock form after a restore. */
export const RESTORED_MESSAGE = "Restored. Enter the backup's passphrase to open it."
