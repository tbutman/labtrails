import { Link, NavLink, Outlet } from 'react-router'
import { DemoProvider } from '../data'

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

export function DemoLayout() {
  return (
    <DemoProvider>
      <div className="page">
        <header className="header">
          <Wordmark />
          <nav className="nav" aria-label="Demo">
            <NavLink to="/demo" end>
              Overview
            </NavLink>
            <NavLink to="/demo/table">Table</NavLink>
            <NavLink to="/demo/reports">Reports</NavLink>
            <NavLink to="/demo/summaries">Summaries</NavLink>
          </nav>
        </header>
        <p className="banner" role="note">
          <strong>Demo:</strong> a made-up person with made-up results from made-up labs. Nothing here is real, and nothing is saved.
        </p>
        <Outlet />
      </div>
    </DemoProvider>
  )
}
