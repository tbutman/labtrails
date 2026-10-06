import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useNavigate, useParams } from 'react-router'
import { loadProfile, type ProfileData } from '../../data/profile'
import { ProfileContext } from '../profileContext'
import { useSession } from '../sessionContext'

/** The router's root: new screens open at the top, and going back returns to where you were. */
export function Root() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}

export function Wordmark() {
  return (
    <Link className="wordmark" to="/" aria-label="LabTrails home">
      <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true">
        <path d="M4 15 C 9 14, 12 10, 14 9 S 20 5, 24 4" fill="none" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="4" cy="15" r="3" fill="var(--accent-fill)" />
        <circle cx="14" cy="9" r="3" fill="var(--accent-fill)" />
        <circle cx="24" cy="4" r="3" fill="var(--accent-fill)" />
      </svg>
      <span className="wordmark-text">
        lab<span>trails</span>
      </span>
    </Link>
  )
}

/** The header, the demo banner and the lock or leave-demo control, on every screen. */
export function Shell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const { mode, lock, exitDemo } = useSession()
  const navigate = useNavigate()
  return (
    <div className="page">
      <header className="header no-print">
        <Wordmark />
        <div className="header-actions">
          {mode === 'unlocked' && (
            <>
              <Link className="button secondary small-button" to="/settings">
                Settings
              </Link>
              <button className="button secondary small-button" onClick={lock}>
                Lock
              </button>
            </>
          )}
          {mode === 'demo' && (
            <button
              className="button secondary small-button"
              onClick={() => {
                exitDemo()
                navigate('/')
              }}
            >
              Leave the demo
            </button>
          )}
        </div>
      </header>
      {mode === 'demo' && (
        <p className="banner no-print" role="note">
          <strong>Demo:</strong> a made-up person with made-up results from made-up labs. Nothing here is real, and nothing is saved.
        </p>
      )}
      {nav}
      {children}
    </div>
  )
}

/** Screens for one person: loads their records from the current store (the vault or the demo). */
export function ProfileLayout() {
  const { profileId = '' } = useParams()
  const { store, version } = useSession()
  const [data, setData] = useState<ProfileData | null | undefined>(undefined)

  useEffect(() => {
    if (!store) return
    let live = true
    void loadProfile(store, profileId).then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [store, profileId, version])

  if (!store) return <Navigate to="/" replace />
  if (data === undefined) return <Shell>{<p className="muted">Loading…</p>}</Shell>
  if (data === null)
    return (
      <Shell>
        <h1>Profile not found</h1>
        <Link to="/">Back to the start</Link>
      </Shell>
    )

  const base = `/p/${data.profile.id}`
  return (
    <ProfileContext value={data}>
      <Shell
        nav={
          <nav className="nav no-print" aria-label={data.profile.name}>
            <NavLink to={base} end>
              Overview
            </NavLink>
            <NavLink to={`${base}/table`}>Table</NavLink>
            <NavLink to={`${base}/reports`}>Reports</NavLink>
            <NavLink to={`${base}/summaries`}>Summaries</NavLink>
            <NavLink to={`${base}/doctor`}>For your doctor</NavLink>
          </nav>
        }
      >
        <Outlet />
      </Shell>
    </ProfileContext>
  )
}
