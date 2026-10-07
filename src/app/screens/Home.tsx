// The app's start (/app): set up a vault, unlock it, or pick a person. The landing page is at /.

import { ArchiveRestore, ChevronRight, KeyRound, Pencil, Plus, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { checkPassphrase, KdfUnavailableError, takeErasedNotice, WeakPassphraseError, WrongPassphraseError } from '../../core'
import { RESTORED_MESSAGE, RestoreBackup } from '../../core/backup/BackupForms'
import { ForgotPassphrase, PassphraseStrength } from '../../core/vault/VaultForms'
import { APP_ID } from '../types'
import type { Profile } from '../../labs/types'
import { AppIcon, Callout, Checkbox, EmptyState, PageHeader, TextField } from '../../core/ui/components'
import { APP } from '../brand'
import { InstallHint } from '../components/InstallHint'
import { Shell } from '../components/Layout'
import { DEMO_PROFILE } from '../demo'
import { useSession } from '../sessionContext'
import { clearDemoEnded, demoEnded, forgetReturnPath, placeName, returnPath, takeReturnPath } from '../returnTo'

export function Home() {
  const { mode } = useSession()
  if (mode === 'loading') return <Shell narrow>{<div className="skeleton loading-card" />}</Shell>
  if (mode === 'demo') return <Navigate to={`${APP}/p/${DEMO_PROFILE.id}`} replace />
  if (mode === 'unlocked') return <Profiles />
  return <Auth />
}

function Auth() {
  const { mode, startDemo, trails, reload, setNotice } = useSession()
  const navigate = useNavigate()
  const [restoring, setRestoring] = useState(false)
  // After "Erase this vault", once (CORE-01).
  const [erased] = useState(() => takeErasedNotice(APP_ID))
  // Where the person was before the vault locked or the page reloaded, and whether a demo just ended (X-05).
  const [ended] = useState(demoEnded)
  const back = mode === 'locked' ? returnPath() : null
  useEffect(() => {
    clearDemoEnded()
    if (mode === 'welcome') forgetReturnPath()
  }, [mode])
  const tryDemo = async () => {
    await startDemo()
    navigate(`${APP}/p/${DEMO_PROFILE.id}`)
  }
  return (
    <Shell>
      <div className="auth">
        <div className="auth-card">
          <div className="auth-head">
            <AppIcon />
            <h1>{restoring ? 'Restore from a backup' : mode === 'locked' ? 'Welcome back' : 'Set up your vault'}</h1>
            <p>
              {restoring
                ? 'Choose a LabTrails backup and enter the passphrase it was made with. It replaces anything already in this browser.'
                : mode === 'locked'
                  ? back
                    ? `You were on ${placeName(back)}. Unlock to continue.`
                    : 'Unlock to see your results.'
                  : 'Your vault is the locked, encrypted space in this browser where LabTrails keeps your results. Choose a passphrase to lock it: a few random words are easiest.'}
            </p>
          </div>
          {erased && !restoring && mode === 'welcome' && (
            <Callout tone="accent">
              <p role="status">Everything is deleted from this browser.</p>
            </Callout>
          )}
          {ended && (
            <Callout tone="accent">
              The demo ended because the page was reloaded.{' '}
              <button className="link-button" onClick={() => void tryDemo()}>
                Try the demo again
              </button>
            </Callout>
          )}
          <div className="card">
            {restoring && trails ? (
              <RestoreBackup
                db={trails.db}
                vault={trails.vault}
                appId={APP_ID}
                appName="LabTrails"
                intro={false}
                onRestored={() => {
                  setRestoring(false)
                  setNotice('restored')
                  void reload()
                }}
              />
            ) : mode === 'locked' ? (
              <Unlock />
            ) : (
              <CreateVault />
            )}
          </div>
          {mode === 'locked' && !restoring && trails && (
            <ForgotPassphrase appId={APP_ID} appName="LabTrails" db={trails.db} vault={trails.vault} channel={trails.channel} home={APP} onRestore={() => setRestoring(true)} />
          )}
          <div className="auth-links">
            <button className="link-button" onClick={() => setRestoring((r) => !r)}>
              {restoring ? 'Back' : 'Restore from a backup'}
            </button>
            <button className="link-button" onClick={() => void tryDemo()}>
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
    const { problem } = checkPassphrase(passphrase, 'LabTrails')
    if (problem) return setError(problem)
    if (passphrase !== again) return setError("The two passphrases don't match.")
    if (!understood) return setError('Please confirm you understand there is no way to reset it.')
    setBusy(true)
    setError('')
    try {
      await createVault(passphrase)
    } catch (err) {
      setError(err instanceof WeakPassphraseError || err instanceof KdfUnavailableError ? err.message : 'The vault could not be created.')
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
      <PassphraseStrength passphrase={passphrase} appName="LabTrails" />
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
      <p className="hint form-footnote">LabTrails keeps records and draws charts; it doesn't diagnose or give medical advice.</p>
    </form>
  )
}

function Unlock() {
  const { unlock, notice } = useSession()
  const navigate = useNavigate()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlock(passphrase)
      const back = takeReturnPath()
      if (back) navigate(back, { replace: true })
    } catch (err) {
      setError(err instanceof WrongPassphraseError ? "That passphrase doesn't open this vault." : err instanceof KdfUnavailableError ? err.message : 'The vault could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {notice === 'restored' && (
        <p className="form-error" role="status">
          {RESTORED_MESSAGE}
        </p>
      )}
      <TextField label="Passphrase" type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} error={error} autoFocus />
      <button className="button primary block large" disabled={busy || !passphrase}>
        <KeyRound size={18} aria-hidden /> {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

function Profiles() {
  const { store, version, core, mode, vaultCreatedAt } = useSession()
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [now] = useState(() => Date.now())
  useEffect(() => {
    if (!store) return
    void store.list<Profile>('profiles').then((p) => setProfiles(p.sort((a, b) => a.name.localeCompare(b.name))))
  }, [store, version])

  // Two weeks since the last backup, or since the vault was created if there's none yet (CHK-04, as BabyTrails).
  const last = Date.parse(core.lastBackupAt ?? vaultCreatedAt ?? '') || now
  const nudge = core.changesSinceBackup > 0 && now - last > 14 * 86_400_000

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
