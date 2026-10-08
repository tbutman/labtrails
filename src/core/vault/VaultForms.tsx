// The vault's shared forms: the passphrase strength hint, changing the passphrase (CORE-02), and
// erasing the vault (CORE-01), in Settings and under Unlock for a forgotten passphrase.

import { useEffect, useState, type FormEvent } from 'react'
import type { Db } from '../store/db'
import { TextField } from '../ui/components'
import type { VaultChannel } from './channel'
import { eraseEverything } from './erase'
import { checkPassphrase, STRENGTH_HINTS } from './passphrase'
import { WeakPassphraseError, WrongPassphraseError, type Vault } from './vault'

/** The three-step hint under a new passphrase: weak, OK, strong. Nothing until something's typed. */
export function PassphraseStrength({ passphrase, appName }: { passphrase: string; appName: string }) {
  if (!passphrase) return null
  const { strength } = checkPassphrase(passphrase, appName)
  return (
    <p className={`hint passphrase-strength ${strength}`} aria-live="polite">
      <span className="passphrase-meter" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {STRENGTH_HINTS[strength]}
    </p>
  )
}

export function ChangePassphrase({ vault, appName }: { vault: Vault; appName: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pbkdf2, setPbkdf2] = useState(false)

  useEffect(() => {
    let live = true
    void vault.header().then((h) => live && setPbkdf2(h?.kdf.alg === 'pbkdf2-sha256'))
    return () => {
      live = false
    }
  }, [vault, message])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    const { problem } = checkPassphrase(next, appName)
    if (problem) return setError(problem)
    if (next !== again) return setError("The two new passphrases don't match.")
    setBusy(true)
    try {
      await vault.changePassphrase(current, next)
      setCurrent('')
      setNext('')
      setAgain('')
      setMessage('Passphrase changed. Older backups still open with the old one.')
    } catch (err) {
      setError(
        err instanceof WrongPassphraseError ? "Your current passphrase isn't right." : err instanceof WeakPassphraseError ? err.message : 'The passphrase could not be changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <TextField label="Current passphrase" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <div>
        <TextField
          label="New passphrase"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="There's no way to reset it. If you forget the new passphrase, nobody can open this vault."
        />
        <PassphraseStrength passphrase={next} appName={appName} />
      </div>
      <TextField label="New passphrase again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={error} />
      <div>
        <button className="button" type="submit" disabled={busy || !current || !next || !again}>
          {busy ? 'Changing…' : 'Change passphrase'}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {pbkdf2 && (
        <p className="hint">
          This vault's key is made from your passphrase with PBKDF2-SHA256 (600,000 rounds), because the browser it was set up in couldn't run
          Argon2id. Changing the passphrase in a browser that can moves it to Argon2id.
        </p>
      )}
    </form>
  )
}

type EraseProps = {
  appId: string
  appName: string
  db: Db
  vault: Vault
  channel?: VaultChannel
  /** Where to start again after erasing, e.g. "/app". */
  home: string
}

/** "Erase this vault": a button that opens the confirmation, which needs the app's name typed. */
export function EraseVault({ appId, appName, db, vault, channel, home, startOpen = false }: EraseProps & { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const matches = typed.trim().toLowerCase() === appName.toLowerCase()

  async function erase(e: FormEvent) {
    e.preventDefault()
    if (!matches) return setError(`Type ${appName} to confirm.`)
    setBusy(true)
    setError('')
    try {
      await eraseEverything({ appId, db, channel })
      setDone(true)
      // A fresh start: nothing of the vault is left in memory either.
      setTimeout(() => {
        vault.lock()
        location.replace(home)
      }, 800)
    } catch {
      setBusy(false)
      setError('Not everything could be deleted. Close the other tabs of this app and try again.')
    }
  }

  if (done) return <p role="status">Everything is deleted from this browser.</p>
  if (!open) {
    return (
      <div>
        <button type="button" className="button danger" onClick={() => setOpen(true)}>
          Erase this vault
        </button>
      </div>
    )
  }
  return (
    <form onSubmit={erase} className="stack erase-vault" noValidate>
      <p>
        This deletes every record, document and setting {appName} keeps in this browser, including your AI key. Backups you downloaded aren't
        affected. It can't be undone. Type {appName} to confirm.
      </p>
      <TextField label={`Type ${appName} to confirm`} autoComplete="off" autoCapitalize="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} error={error} />
      <div className="row">
        <button className="button primary danger-fill" type="submit" disabled={busy || !matches}>
          {busy ? 'Erasing…' : 'Erase everything'}
        </button>
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false)
            setTyped('')
            setError('')
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Under the Unlock form: what to do about a forgotten passphrase. */
export function ForgotPassphrase({ onRestore, ...erase }: EraseProps & { onRestore: () => void }) {
  const [open, setOpen] = useState(false)
  const [erasing, setErasing] = useState(false)
  if (!open) {
    return (
      <button type="button" className="link-button forgot-passphrase" onClick={() => setOpen(true)}>
        Forgot your passphrase?
      </button>
    )
  }
  return (
    <div className="forgot-passphrase stack">
      <p>
        <strong>Forgot your passphrase?</strong> Nobody can reset it. You can restore a backup, or erase this vault and start again.
      </p>
      {erasing ? (
        <EraseVault {...erase} startOpen />
      ) : (
        <div className="row">
          <button type="button" className="button small" onClick={onRestore}>
            Restore a backup
          </button>
          <button type="button" className="button small danger" onClick={() => setErasing(true)}>
            Erase this vault
          </button>
        </div>
      )}
    </div>
  )
}
