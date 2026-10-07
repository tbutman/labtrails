// The app's start (/app): set up a vault, unlock it, or pick a person. The landing page is at /.

import { ArchiveRestore, ChevronRight, KeyRound, Pencil, Plus, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { MIN_PASSPHRASE_LENGTH, WeakPassphraseError, WrongPassphraseError } from '../../core'
import type { Profile } from '../../labs/types'
import { AppIcon, Callout, Checkbox, EmptyState, PageHeader, TextField } from '../../core/ui/components'
import { APP } from '../brand'
import { InstallHint } from '../components/InstallHint'
import { Shell } from '../components/Layout'
import { DEMO_PROFILE } from '../demo'
import { useSession } from '../sessionContext'
import { RestoreBackup } from './Backup'

export function Home() {
  const { mode } = useSession()
  if (mode === 'loading') return <Shell narrow>{<div className="skeleton loading-card" />}</Shell>
  if (mode === 'demo') return <Navigate to={`${APP}/p/${DEMO_PROFILE.id}`} replace />
  if (mode === 'unlocked') return <Profiles />
  return <Auth />
}

function Auth() {
  const { mode, startDemo } = useSession()
  const navigate = useNavigate()
  const [restoring, setRestoring] = useState(false)
  return (
    <Shell>
      <div className="auth">
        <div className="auth-card">
          <div className="auth-head">
            <AppIcon />
            <h1>{mode === 'locked' ? 'Welcome back' : 'Set up your vault'}</h1>
            <p>{mode === 'locked' ? 'Unlock to see your results.' : 'Your vault is the locked, encrypted space in this browser where LabTrails keeps your results. Choose a passphrase to lock it: a few random words are easiest.'}</p>
          </div>
          <div className="card">{restoring ? <RestoreBackup /> : mode === 'locked' ? <Unlock /> : <CreateVault />}</div>
          <div className="auth-links">
            <button className="link-button" onClick={() => setRestoring((r) => !r)}>
              {restoring ? 'Back' : 'Restore from a backup'}
            </button>
            <button
              className="link-button"
              onClick={async () => {
                await startDemo()
                navigate(`${APP}/p/${DEMO_PROFILE.id}`)
              }}
            >
              Try the demo instead
            </button>
          </div>
        </div>
      </div>
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
      <TextField
        label="Passphrase"
        type="password"
        autoComplete="new-password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        hint="At least 12 characters. Four or more random words are easy to type and hard to guess."
      />
      <TextField label="Passphrase again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <Checkbox checked={understood} onChange={setUnderstood}>
        <strong>There's no way to reset it.</strong> If I forget it, my results can't be recovered, so I'll keep a backup.
      </Checkbox>
      {error && (
        <p className="error form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary block large" disabled={busy}>
        <ShieldCheck size={18} aria-hidden /> {busy ? 'Setting up…' : 'Create the vault'}
      </button>
      <p className="hint form-footnote">LabTrails records and charts results; it doesn't diagnose anything or give medical advice.</p>
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
      <TextField label="Passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} error={error} autoFocus />
      <button className="button primary block large" disabled={busy || !passphrase}>
        <KeyRound size={18} aria-hidden /> {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

function Profiles() {
  const { store, version, core, mode } = useSession()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [now] = useState(() => Date.now())
  useEffect(() => {
    if (!store) return
    void store.list<Profile>('profiles').then((p) => setProfiles(p.sort((a, b) => a.name.localeCompare(b.name))))
  }, [store, version])

  const nudge = core.changesSinceBackup > 0 && (!core.lastBackupAt || now - Date.parse(core.lastBackupAt) > 14 * 86_400_000)

  return (
    <Shell>
      <PageHeader
        title="People"
        subtitle="Whose results this vault keeps."
        actions={
          profiles && profiles.length > 0 ? (
            <Link className="button primary" to={`${APP}/profiles/new`}>
              <Plus size={16} aria-hidden /> Add a person
            </Link>
          ) : undefined
        }
      />
      <InstallHint />
      {nudge && (
        <Callout icon={ArchiveRestore} tone="warning">
          You have changes that aren't in a backup. Clearing this browser's data would delete them. <Link to={`${APP}/settings`}>Download a backup</Link>
        </Callout>
      )}
      {profiles === null ? (
        <div className="skeleton loading-card" />
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add the first person"
          action={
            <Link className="button primary" to={`${APP}/profiles/new`}>
              <Plus size={16} aria-hidden /> Add a person
            </Link>
          }
        >
          Probably you. You can add others later, such as a partner, with their agreement.
        </EmptyState>
      ) : (
        <div className="card padless">
          <ul className="list">
            {profiles.map((p) => (
              <li key={p.id} className="person-row">
                <Link className="list-row" to={`${APP}/p/${p.id}`}>
                  <span className="avatar" aria-hidden="true">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="list-row-main">
                    <span className="list-row-title">{p.name}</span>
                  </span>
                  <ChevronRight size={18} className="faint" aria-hidden />
                </Link>
                {mode === 'unlocked' && (
                  <Link className="icon-button" to={`${APP}/profiles/${p.id}`} aria-label={`Edit or delete ${p.name}`}>
                    <Pencil size={16} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  )
}
