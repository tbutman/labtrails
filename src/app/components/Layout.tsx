import { CalendarRange, FileText, LayoutDashboard, Lock, LogOut, Settings, Sparkles, Stethoscope, Table2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, ScrollRestoration, useNavigate, useParams } from 'react-router'
import { loadProfile, type ProfileData } from '../../data/profile'
import { AppBar, Callout, type NavItem } from '../../core/ui/components'
import { PageChange, SkipLink } from '../../core/ui/navigation'
import { UpdatePrompt } from '../../core/ui/UpdatePrompt'
import { APP, BRAND } from '../brand'
import { ProfileContext } from '../profileContext'
import { useSession } from '../sessionContext'

/** The router's root: new screens open at the top, and going back returns to where you were. */
export function Root() {
  const { mode } = useSession()
  return (
    <>
      <SkipLink />
      <UpdatePrompt appName="LabTrails" locksVault={mode === 'unlocked'} />
      <Outlet />
      <ScrollRestoration />
      <PageChange appName="LabTrails" />
    </>
  )
}

/** Every screen inside the app: the app bar, the demo notice, and the page. */
export function Shell({ children, nav, narrow }: { children: ReactNode; nav?: NavItem[]; narrow?: boolean }) {
  const { mode, lock } = useSession()
  const navigate = useNavigate()
  const actions = (
    <>
      {mode === 'unlocked' && (
        <>
          <Link className="icon-button" to={`${APP}/settings`} aria-label="Settings" title="Settings">
            <Settings size={18} aria-hidden />
          </Link>
          <button className="button small" onClick={lock}>
            <Lock size={14} aria-hidden /> Lock
          </button>
        </>
      )}
      {mode === 'demo' && (
        <button
          className="button small"
          // The landing page clears the demo once it's showing; clearing it here would make these
          // screens redirect into the app before the navigation lands.
          onClick={() => void navigate('/', { state: { leaveDemo: true } })}
        >
          <LogOut size={14} aria-hidden /> Leave demo
        </button>
      )}
    </>
  )
  return (
    <div className={nav?.length ? 'has-tab-bar' : undefined}>
      <AppBar brand={BRAND} home={APP} nav={nav} actions={actions} />
      <main id="main" className="app-main">
        <div className={`container${narrow ? ' narrow' : ''}`}>
          {mode === 'demo' && (
            <div className="no-print">
              <Callout tone="accent">
                <strong>Demo.</strong> A made-up person with made-up results from made-up labs. Nothing here is real, and nothing is saved.
              </Callout>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}

function Loading() {
  return (
    <Shell>
      <div className="skeleton loading-title" />
      <div className="metric-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton loading-card" />
        ))}
      </div>
    </Shell>
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

  if (!store) return <Navigate to={APP} replace />
  if (data === undefined) return <Loading />
  if (data === null)
    return (
      <Shell>
        <h1>Person not found</h1>
        <Link to={APP}>Back to the start</Link>
      </Shell>
    )

  const base = `${APP}/p/${data.profile.id}`
  const nav: NavItem[] = [
    { to: base, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `${base}/table`, label: 'Table', icon: Table2 },
    { to: `${base}/reports`, label: 'Reports', icon: FileText },
    { to: `${base}/timeline`, label: 'Timeline', icon: CalendarRange },
    { to: `${base}/summaries`, label: 'Summaries', icon: Sparkles },
    { to: `${base}/doctor`, label: 'Doctor', icon: Stethoscope },
  ]
  return (
    <ProfileContext value={data}>
      <Shell nav={nav}>
        <Outlet />
      </Shell>
    </ProfileContext>
  )
}

/** Addresses from before the app moved under /app keep working. */
export function LegacyProfile() {
  const { profileId, '*': rest } = useParams()
  return <Navigate to={`${APP}/p/${profileId}${rest ? `/${rest}` : ''}`} replace />
}
