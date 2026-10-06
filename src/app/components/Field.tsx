import type { ReactNode } from 'react'

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {hint && (
        <p className="hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
