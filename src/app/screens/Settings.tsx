import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../core'
import { ApiKeySettings } from '../../core/ai/ApiKeySettings'
import type { Theme } from '../../core/settings/settings'
import { Field } from '../components/Field'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'
import { ExportBackup, RestoreBackup } from './Backup'

export function Settings() {
  const { mode, core, saveCore } = useSession()
  if (mode !== 'unlocked') return <Navigate to="/" replace />
  return (
    <Shell>
      <h1>Settings</h1>

      <section className="card panel">
        <h2 className="flush">Backup</h2>
        <ExportBackup />
      </section>

      <section className="card panel" id="ai">
        <h2 className="flush">AI (optional)</h2>
        <p className="small">
          Reading reports and writing summaries use your own Anthropic API key. Use a dedicated key with a spending limit set in Anthropic's console.
          The key is stored only in this encrypted vault and sent only to Anthropic.
        </p>
        <ApiKeySettings apiKey={core.ai.apiKey} model={core.ai.model} onSave={({ apiKey, model }) => void saveCore({ ...core, ai: { ...core.ai, apiKey, model } })} />
      </section>

      <section className="card panel">
        <h2 className="flush">Appearance and locking</h2>
        <Field label="Theme" htmlFor="theme">
          <select id="theme" value={core.theme} onChange={(e) => void saveCore({ ...core, theme: e.target.value as Theme })}>
            <option value="system">Follow the device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Lock after this many minutes without use" htmlFor="autolock">
          <select id="autolock" value={core.autoLockMinutes} onChange={(e) => void saveCore({ ...core, autoLockMinutes: Number(e.target.value) })}>
            {[1, 2, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="card panel">
        <h2 className="flush">Change passphrase</h2>
        <ChangePassphrase />
      </section>

      <details className="card panel">
        <summary>Restore from a backup</summary>
        <RestoreBackup />
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
      <Field label="Current passphrase" htmlFor="current-passphrase">
        <input id="current-passphrase" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New passphrase" htmlFor="new-passphrase">
        <input id="new-passphrase" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      {message && (
        <p className={message.ok ? 'hint' : 'error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      <button className="button secondary" disabled={!current || !next}>
        Change passphrase
      </button>
    </form>
  )
}
