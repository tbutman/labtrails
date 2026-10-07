// Where the user adds their own Anthropic API key and picks a model. The key is saved only in the
// encrypted settings; this form never shows it again in full.

import { useState, type FormEvent } from 'react'
import { MODELS } from './models'

type Props = {
  /** For "lets BabyTrails use its AI". Defaults to "this app". */
  appName?: string
  apiKey?: string
  model: string
  onSave: (next: { apiKey?: string; model: string }) => Promise<void> | void
}

export function ApiKeySettings({ appName = 'this app', apiKey, model, onSave }: Props) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaved('')
    const key = draft.trim()
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) {
      setError('That doesn\'t look like an Anthropic API key. They start with "sk-ant-".')
      return
    }
    setError('')
    await onSave({ apiKey: key, model })
    setDraft('')
    setSaved('Key saved, encrypted in your vault.')
  }

  return (
    <div className="stack">
      <p>
        An API key is a password-like code from Anthropic that lets {appName} use its AI on your account.{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">
          Get one at console.anthropic.com
        </a>
        .
      </p>
      <p>
        Anthropic bills you directly, and nothing goes through {appName === 'this app' ? "this app's" : `the ${appName}`} server. Create a{' '}
        <strong>separate key just for {appName}</strong> and set a monthly spending limit in the Anthropic Console.
      </p>
      <p className="hint">
        If your Anthropic organization has zero data retention, browser requests aren't allowed for it; use a key from another organization.
      </p>
      {apiKey ? (
        <p className="hint">
          A key ending in …{apiKey.slice(-4)} is saved.{' '}
          <button type="button" className="link-button" onClick={() => void onSave({ apiKey: undefined, model })}>
            Remove it
          </button>
        </p>
      ) : (
        <p className="hint">No key saved. AI features stay off until you add one.</p>
      )}
      <form onSubmit={submit} className="stack" noValidate>
        <div className={`field${error ? ' has-error' : ''}`}>
          <label htmlFor="api-key">{apiKey ? 'Replace the key' : 'Anthropic API key'}</label>
          <input id="api-key" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="button" type="submit" disabled={!draft}>
          Save key
        </button>
        {saved && <p role="status">{saved}</p>}
      </form>
      <div className="field">
        <label htmlFor="ai-model">Model</label>
        <select id="ai-model" value={model} onChange={(e) => void onSave({ apiKey, model: e.target.value })}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
