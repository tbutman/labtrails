import { useState, type FormEvent } from 'react'
import { ToStart } from '../returnTo'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../core'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import type { Theme } from '../../core/settings/settings'
import { PageHeader, Segmented, SelectField, TextField } from '../../core/ui/components'
import { APP } from '../brand'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'
import { ExportBackup, RestoreBackup } from './Backup'

export function Settings() {
  const { mode, core, saveCore } = useSession()
  if (mode !== 'unlocked') return <ToStart />
  return (
    <Shell narrow>
      <PageHeader title="Settings" back={{ to: APP, label: 'People' }} />

      <h2 className="section-title">Backup</h2>
      <div className="card">
        <ExportBackup />
      </div>

      <h2 className="section-title" id="ai">
        AI (optional)
      </h2>
      <div className="card">
        <ApiKeySettings apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => void saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
      </div>

      <h2 className="section-title">Appearance and locking</h2>
      <div className="card">
        <Segmented<Theme>
          legend="Theme"
          name="theme"
          value={core.theme}
          onChange={(theme) => void saveCore({ ...core, theme })}
          options={[
            { value: 'system', label: 'Device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <SelectField label="Lock after" value={core.autoLockMinutes} onChange={(e) => void saveCore({ ...core, autoLockMinutes: Number(e.target.value) })} hint="Locking drops the keys from memory.">
          {[1, 2, 5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>
              {m} minute{m === 1 ? '' : 's'} without use
            </option>
          ))}
        </SelectField>
      </div>

      <h2 className="section-title">Passphrase</h2>
      <div className="card">
        <ChangePassphrase />
      </div>

      <h2 className="section-title">Restore</h2>
      <details className="disclosure">
        <summary>Restore from a backup</summary>
        <div className="disclosure-body">
          <RestoreBackup />
        </div>
      </details>
    </Shell>
  )
}

function ChangePassphrase() {
  const { trails } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trails) return
    if (next.length < MIN_PASSPHRASE_LENGTH) return setMessage({ ok: false, text: `Use at least ${MIN_PASSPHRASE_LENGTH} characters.` })
    try {
      await trails.vault.changePassphrase(current, next)
      setCurrent('')
      setNext('')
      setMessage({ ok: true, text: 'Passphrase changed. Older backups still open with the old one.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof WrongPassphraseError ? "The current passphrase isn't right." : 'The passphrase could not be changed.' })
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="input-row">
        <TextField label="Current passphrase" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label="New passphrase" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      {message && (
        <p className={message.ok ? 'hint form-error' : 'error form-error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <button className="button" disabled={!current || !next}>
        Change passphrase
      </button>
    </form>
  )
}
