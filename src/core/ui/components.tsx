// Trails UI v2: small React components on top of components.css, shared by BabyTrails and LabTrails.
// They're thin wrappers: the styling lives in CSS so the core's other components look the same.
// Icons are Lucide (ISC license), bundled with the app; pass any lucide-react icon component.

import { Check } from 'lucide-react'
import { useId, type ComponentType, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link, NavLink } from 'react-router'

export type Icon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean; className?: string }>

/* ---------- Brand ---------- */

export type Brand = {
  /** The app's name, e.g. "LabTrails". */
  name: string
  /** The first part of the lowercase wordmark, e.g. "lab" for "labtrails". */
  prefix: string
  /** Home link for the wordmark. */
  home: string
  /** The sister app, for the footer and the family link. */
  sister: { name: string; prefix: string; url: string; tagline: string }
  repo: string
}

/** The trail mark: three dots on a rising line, in the app's accent. */
export function TrailMark({ size = 26, onDark = false }: { size?: number; onDark?: boolean }) {
  const stroke = onDark ? 'var(--accent-dark, var(--accent))' : 'var(--accent-text)'
  const fill = onDark ? 'var(--accent-dark, var(--accent))' : 'var(--accent)'
  return (
    <svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" aria-hidden="true">
      <path d="M4 15 C 9 14, 12 10, 14 9 S 20 5, 24 4" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="4" cy="15" r="3" fill={fill} />
      <circle cx="14" cy="9" r="3" fill={fill} />
      <circle cx="24" cy="4" r="3" fill={fill} />
    </svg>
  )
}

export function Wordmark({ brand, to }: { brand: Pick<Brand, 'name' | 'prefix' | 'home'>; to?: string }) {
  return (
    <Link className="wordmark" to={to ?? brand.home} aria-label={`${brand.name} home`}>
      <TrailMark />
      <span>
        {brand.prefix}
        <span className="wordmark-accent">trails</span>
      </span>
    </Link>
  )
}

export function AppIcon({ size = 56 }: { size?: number }) {
  return (
    <span className="app-icon" style={size === 56 ? undefined : { width: size, height: size }}>
      <TrailMark size={size * 0.5} onDark />
    </span>
  )
}

/* ---------- App shell ---------- */

export type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

/** The sticky top bar, with the app's sections on wide screens and a bottom tab bar on phones. */
export function AppBar({ brand, nav = [], actions, home }: { brand: Brand; nav?: NavItem[]; actions?: ReactNode; home?: string }) {
  return (
    <>
      <header className="app-bar no-print">
        <div className="container app-bar-inner">
          <Wordmark brand={brand} to={home} />
          {nav.length > 0 && (
            <nav className="app-bar-nav" aria-label="Sections">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                  <n.icon size={16} aria-hidden />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="app-bar-actions">{actions}</div>
        </div>
      </header>
      {nav.length > 0 && (
        <nav className="tab-bar no-print" aria-label="Sections">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="tab-link">
              <n.icon size={22} strokeWidth={1.8} aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <>
      {back && (
        <Link className="back-link" to={back.to}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </>
  )
}

export function Callout({ icon: I, tone, children }: { icon?: Icon; tone?: 'accent' | 'warning' | 'danger'; children: ReactNode }) {
  return (
    <div className={`callout${tone ? ` ${tone}` : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      {I && <I size={18} aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

export function EmptyState({ icon: I, title, children, action }: { icon: Icon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <I size={22} aria-hidden />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

/* ---------- Form controls ---------- */

type FieldProps = { label: string; hint?: ReactNode; error?: string; children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }

/** A label, the control, a hint and an error, wired together for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, ...input }: { label: string; hint?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...input} />}
    </Field>
  )
}

export function SelectField({ label, hint, error, children, ...select }: { label: string; hint?: ReactNode; error?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...select}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function TextAreaField({ label, hint, error, ...area }: { label: string; hint?: ReactNode; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...area} />}
    </Field>
  )
}

/** One choice from a few, as a segmented control (radio buttons underneath). */
export function Segmented<T extends string>({ legend, name, options, value, onChange, hint }: { legend: string; name: string; options: { value: T; label: string }[]; value: T | undefined; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  )
}

/** Several choices as toggleable chips (checkboxes underneath). */
export function ChipGroup<T extends string>({ legend, options, value, onChange }: { legend: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="chip-group">
        {options.map((o) => (
          <label key={o.value} className="toggle-chip">
            <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value))} />
            {/* A check mark on selected chips, so "selected" isn't shown by the tint alone. */}
            <span>
              {value.includes(o.value) && <Check size={14} strokeWidth={2.6} aria-hidden />}
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Switch({ label, description, checked, onChange }: { label: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="spread">
      <div>
        <label htmlFor={id} className="list-row-title">
          {label}
        </label>
        {description && <div className="hint">{description}</div>}
      </div>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden="true" />
      </span>
    </div>
  )
}

export function Checkbox({ label, checked, onChange, children }: { label?: ReactNode; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label ?? children}</span>
    </label>
  )
}

/** A file picker that's also a drop target. */
export function FileDrop({ label, hint, accept, icon: I, onFile }: { label: string; hint?: ReactNode; accept?: string; icon: Icon; onFile: (file: File) => void }) {
  const id = useId()
  return (
    <div
      className="drop-zone"
      onDragOver={(e) => {
        e.preventDefault()
        e.currentTarget.classList.add('dragging')
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('dragging')}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove('dragging')
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
    >
      <input id={id} type="file" accept={accept} aria-label={label} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <span className="drop-zone-icon">
        <I size={22} aria-hidden />
      </span>
      <span className="drop-zone-title">{label}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

/* ---------- Data ---------- */

export function Chip({ icon: I, tone, children }: { icon?: Icon; tone?: 'flag' | 'accent' | 'outline'; children: ReactNode }) {
  return (
    <span className={`chip${tone ? ` ${tone}` : ''}`}>
      {I && <I size={13} strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  )
}

export type SparkPoint = { value: number; low?: number; high?: number; flagged?: boolean }

/**
 * A small trend line. Scaled to the values (not the ranges, which can be much wider), with each point's
 * own range as a pale bar clipped to the chart, and flagged points ringed.
 */
export function Sparkline({ points, label }: { points: SparkPoint[]; label?: string }) {
  if (points.length === 0) return null
  const W = 240
  const H = 44
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.35, Math.abs(max) * 0.04, 1e-6)
  const lo = min - pad
  const hi = max + pad
  const x = (i: number) => (points.length === 1 ? W / 2 : 8 + (i / (points.length - 1)) * (W - 16))
  const y = (v: number) => Math.min(H, Math.max(0, 4 + (1 - (v - lo) / (hi - lo)) * (H - 8)))
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {points.map((p, i) =>
        p.low !== undefined || p.high !== undefined ? (
          <rect key={`r${i}`} x={x(i) - 4} y={y(p.high ?? Infinity)} width={8} height={Math.max(y(p.low ?? -Infinity) - y(p.high ?? Infinity), 2)} rx={4} fill="var(--accent-soft)" />
        ) : null,
      )}
      {points.length > 1 && <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--accent-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) =>
        p.flagged ? (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill="var(--flag-soft)" stroke="var(--flag)" strokeWidth={2} />
        ) : i === points.length - 1 ? (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill="var(--accent)" />
        ) : null,
      )}
    </svg>
  )
}

export function MetricCard({ to, label, value, unit, chips, foot, children }: { to?: string; label: string; value: ReactNode; unit?: string; chips?: ReactNode; foot?: ReactNode; children?: ReactNode }) {
  const body = (
    <>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {children}
      {chips && <div className="metric-flags">{chips}</div>}
      {foot && <div className="metric-foot">{foot}</div>}
    </>
  )
  return to ? (
    <Link className="metric" to={to}>
      {body}
    </Link>
  ) : (
    <div className="metric">{body}</div>
  )
}
