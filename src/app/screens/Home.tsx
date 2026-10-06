import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { MIN_PASSPHRASE_LENGTH, WeakPassphraseError, WrongPassphraseError } from '../../core'
import type { Profile } from '../../labs/types'
import { DEMO_PROFILE } from '../demo'
import { Field } from '../components/Field'
import { InstallHint } from '../components/InstallHint'
import { Shell } from '../components/Layout'
import { useSession } from '../sessionContext'
import { RestoreBackup } from './Backup'

export function Home() {
  const { mode } = useSession()
  if (mode === 'loading') return <Shell>{<p className="muted">Loading…</p>}</Shell>
  if (mode === 'demo') return <Navigate to={`/p/${DEMO_PROFILE.id}`} replace />
  if (mode === 'unlocked') return <Profiles />
  return <Welcome />
}

function Welcome() {
  const { mode, startDemo } = useSession()
  const navigate = useNavigate()
  return (
    <Shell>
      <h1>Your blood test results, private and in one place</h1>
      <p>
        Keep your lab reports together, see each marker over time against the lab's own range, and spot what's outside the range or has
        changed, to discuss with your doctor.
      </p>
      <div className="grid-2">
        <section className="card">{mode === 'locked' ? <Unlock /> : <CreateVault />}</section>
        <section className="card">
          <h2 className="flush">Try the demo</h2>
          <p>Three years of made-up results from two made-up labs, one in the US and one in Portugal. No passphrase, no API key.</p>
          <button
            className="button secondary"
            onClick={async () => {
              await startDemo()
              navigate(`/p/${DEMO_PROFILE.id}`)
            }}
          >
            Open the demo
          </button>
        </section>
      </div>
      <About />
      <details className="card panel">
        <summary>Restore from a backup</summary>
        <RestoreBackup />
      </details>
    </Shell>
  )
}

function CreateVault() {
  const { createVault } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [again, setAgain] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters. Four or more random words work well.`)
    if (passphrase !== again) return setError("The two passphrases don't match.")
    if (!understood) return setError('Please confirm you understand there is no way to reset it.')
    setBusy(true)
    setError('')
    try {
      await createVault(passphrase)
    } catch (err) {
      setError(err instanceof WeakPassphraseError ? err.message : 'The vault could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="flush">Set up your vault</h2>
      <p className="small">Your results are encrypted with a passphrase and stored only in this browser.</p>
      <Field label="Passphrase" htmlFor="passphrase" hint="At least 12 characters. Four or more random words are easy to type and hard to guess.">
        <input id="passphrase" type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} aria-describedby="passphrase-hint" />
      </Field>
      <Field label="Passphrase again" htmlFor="passphrase-again">
        <input id="passphrase-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>
          <strong>There's no way to reset it.</strong> If I forget it, my results can't be recovered, so I'll keep a backup.
        </span>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? 'Setting up…' : 'Create the vault'}
      </button>
      <p className="disclaimer">
        LabTrails records and charts results; it doesn't diagnose anything or give medical advice. Discuss your results with your doctor.
      </p>
    </form>
  )
}

function Unlock() {
  const { unlock } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlock(passphrase)
    } catch (err) {
      setError(err instanceof WrongPassphraseError ? "That passphrase doesn't open this vault." : 'The vault could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="flush">Unlock</h2>
      <Field label="Passphrase" htmlFor="unlock-passphrase" error={error}>
        <input id="unlock-passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoFocus />
      </Field>
      <button className="button" disabled={busy || !passphrase}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

function Profiles() {
  const { store, version, core } = useSession()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [now] = useState(() => Date.now())
  useEffect(() => {
    if (!store) return
    void store.list<Profile>('profiles').then((p) => setProfiles(p.sort((a, b) => a.name.localeCompare(b.name))))
  }, [store, version])

  const nudge = core.changesSinceBackup > 0 && (!core.lastBackupAt || now - Date.parse(core.lastBackupAt) > 14 * 86_400_000)

  return (
    <Shell>
      <h1>People</h1>
      <InstallHint />
      {nudge && (
        <p className="banner" role="status">
          You have changes that aren't in a backup. Clearing this browser's data would delete them. <Link to="/settings">Download a backup</Link>
        </p>
      )}
      {profiles === null ? (
        <p className="muted">Loading…</p>
      ) : profiles.length === 0 ? (
        <p>Add the first person whose results you want to keep: probably you.</p>
      ) : (
        <ul className="marker-list card">
          {profiles.map((p) => (
            <li key={p.id}>
              <Link className="marker-row" to={`/p/${p.id}`}>
                <span className="marker-name">{p.name}</span>
                <span className="marker-value muted">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="button" to="/profiles/new">
          Add a person
        </Link>
      </p>
      <About />
    </Shell>
  )
}

function About() {
  return (
    <>
      <h2>How it works</h2>
      <ul>
        <li>
          <strong>Your results stay on your device</strong>, encrypted in your browser. There are no accounts and no server database. One vault
          per device for now: to move your results, use a backup.
        </li>
        <li>
          <strong>AI is optional and uses your own key.</strong> If you ask it to read a report or write a summary, your browser sends that
          request straight to the AI provider.
        </li>
        <li>
          <strong>The code flags; the AI explains; you confirm.</strong> What's outside a range or has changed is decided by simple, published
          rules. <Link to="/how-flags-work">How flags work</Link>
        </li>
        <li>
          <strong>Not medical advice.</strong> LabTrails records and charts results. It doesn't diagnose anything; that's your doctor's job.
        </li>
      </ul>
    </>
  )
}
