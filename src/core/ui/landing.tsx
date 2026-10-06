// Trails UI v2: landing-page sections. Each app builds its own page from these, so the two landing
// pages share one structure and look, with only the copy, screenshots and accent different.

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TrailMark, Wordmark, type Brand, type Icon } from './components'

export function LandingNav({ brand, links, actions }: { brand: Brand; links: { href: string; label: string }[]; actions: ReactNode }) {
  return (
    <header className="landing-nav">
      <div className="container landing-nav-inner">
        <Wordmark brand={brand} to="/" />
        <nav className="landing-nav-links" aria-label="Page">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="landing-nav-actions">{actions}</div>
      </div>
    </header>
  )
}

export function Hero({ eyebrow, title, lead, actions, proof, visual }: { eyebrow: ReactNode; title: ReactNode; lead: ReactNode; actions: ReactNode; proof?: { value: string; label: string }[]; visual: ReactNode }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p className="hero-lead">{lead}</p>
          <div className="hero-actions">{actions}</div>
          {proof && (
            <ul className="hero-proof" aria-label="At a glance">
              {proof.map((p) => (
                <li key={p.label}>
                  <strong>{p.value}</strong> {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hero-visual">{visual}</div>
      </div>
    </section>
  )
}

export function Section({ id, tint, kicker, title, lead, children }: { id?: string; tint?: boolean; kicker?: string; title?: ReactNode; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className={`section${tint ? ' tint' : ''}`}>
      <div className="container">
        {(title || kicker) && (
          <div className="section-head">
            {kicker && <div className="kicker">{kicker}</div>}
            {title && <h2>{title}</h2>}
            {lead && <p>{lead}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}

export function FeatureGrid({ items }: { items: { icon: Icon; title: string; text: ReactNode }[] }) {
  return (
    <div className="feature-grid">
      {items.map((f) => (
        <div key={f.title} className="feature">
          <span className="feature-icon">
            <f.icon size={20} aria-hidden />
          </span>
          <h3>{f.title}</h3>
          <p>{f.text}</p>
        </div>
      ))}
    </div>
  )
}

export function Steps({ items }: { items: { title: string; text: ReactNode }[] }) {
  return (
    <ol className="steps">
      {items.map((s) => (
        <li key={s.title} className="step">
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  )
}

export function Showcase({ title, text, points, visual, reverse, checkIcon: Check }: { title: string; text: ReactNode; points?: ReactNode[]; visual: ReactNode; reverse?: boolean; checkIcon: Icon }) {
  return (
    <div className={`showcase${reverse ? ' reverse' : ''}`}>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        {points && (
          <ul className="check-list">
            {points.map((p, i) => (
              <li key={i}>
                <Check size={18} aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>{visual}</div>
    </div>
  )
}

export function PrivacyPanel({ title, text, points, checkIcon: Check, footer }: { title: string; text: ReactNode; points: ReactNode[]; checkIcon: Icon; footer?: ReactNode }) {
  return (
    <div className="privacy-panel">
      <div>
        <TrailMark size={34} onDark />
        <h2>{title}</h2>
        <p>{text}</p>
        {footer}
      </div>
      <ul className="check-list">
        {points.map((p, i) => (
          <li key={i}>
            <Check size={18} aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="faq">
      {items.map((f) => (
        <details key={f.q} className="disclosure">
          <summary>{f.q}</summary>
          <div className="disclosure-body muted">{f.a}</div>
        </details>
      ))}
    </div>
  )
}

export function CtaBand({ title, text, actions }: { title: string; text: ReactNode; actions: ReactNode }) {
  return (
    <div className="cta-band">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="hero-actions">{actions}</div>
    </div>
  )
}

export function SiteFooter({ brand, product }: { brand: Brand; product: { label: string; to: string }[] }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="stack">
          <Wordmark brand={brand} to="/" />
          <p className="small">
            Free and open source (MIT). Your records stay encrypted on your device. Not medical advice.
          </p>
          <a className="family-badge" href={brand.sister.url} title={`${brand.sister.name}: ${brand.sister.tagline}`}>
            <TrailMark size={20} />
            <span>
              Also from Trails: <strong>{brand.sister.name}</strong>
            </span>
          </a>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            {product.map((p) => (
              <li key={p.to}>
                <Link to={p.to}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Open source</h4>
          <ul>
            <li>
              <a href={brand.repo}>Source code</a>
            </li>
            <li>
              <a href={`${brand.repo}/blob/main/THREAT_MODEL.md`}>Threat model</a>
            </li>
            <li>
              <a href={`${brand.repo}/blob/main/SECURITY.md`}>Report a vulnerability</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Made by</h4>
          <ul>
            <li>
              <a href="https://tbutman.com">Thomas Butman</a>
            </li>
            <li>
              <a href={brand.sister.url}>{brand.sister.name}</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
