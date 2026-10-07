// The "what will be sent, and to whom" step before every AI request. Nothing is sent until the user
// taps Send. Apps supply the wording; the sheet always names the provider and what isn't sent.

import type { ReactNode } from 'react'
import { estimateCents, modelInfo } from './models'

// When the terms line was last checked against Anthropic's terms (CORE-12). Recheck and update both.
export const TERMS_CHECKED = 'October 6, 2026'
export const TERMS_URL = 'https://www.anthropic.com/legal/commercial-terms'

export type SendSheetProps = {
  // The app's name, for "it doesn't go through the <app> server".
  appName: string
  // What's being sent, in plain words, e.g. "1 PDF, 2 pages (340 kB)".
  sending: string[]
  // What's deliberately left out, e.g. "your baby's name and date of birth".
  notSending?: string[]
  // Extra warnings, e.g. "the document itself may contain your baby's name".
  notes?: string[]
  model: string
  estimate?: { inputTokens: number; outputTokens: number }
  busy?: boolean
  onSend: () => void
  onCancel: () => void
}

export function SendSheet({ appName, sending, notSending = [], notes = [], model, estimate, busy, onSend, onCancel }: SendSheetProps) {
  const cents = estimate ? estimateCents(model, estimate.inputTokens, estimate.outputTokens) : undefined
  return (
    <section className="send-sheet card" aria-labelledby="send-sheet-title">
      <h2 id="send-sheet-title">Send to Anthropic?</h2>
      <p>
        Your browser will send this straight to Anthropic, the AI provider, using your API key. It doesn't go
        through the {appName} server.
      </p>
      <p className="legend">Sent</p>
      <ul>
        {sending.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {notSending.length > 0 && (
        <>
          <p className="legend">Not sent</p>
          <ul>
            {notSending.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {notes.map((n) => (
        <p key={n} className="hint">
          {n}
        </p>
      ))}
      <p className="hint">
        Model: {modelInfo(model).label.replace(/ \(.*\)$/, '')}.
        {cents !== undefined && ` Rough cost: ${cents < 1 ? 'under 1 US cent' : `about ${Math.round(cents)} US cents`}, billed by Anthropic to you.`}{' '}
        As of {TERMS_CHECKED}, Anthropic's terms say it doesn't train on API content and deletes it within 30 days (up to 2 years if flagged
        by its safety systems).{' '}
        <a href={TERMS_URL} target="_blank" rel="noreferrer">
          Anthropic's terms
        </a>
      </p>
      <div className="row">
        <button type="button" className="button primary" onClick={onSend} disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </section>
  )
}

// Wraps anything the AI wrote: labeled, with the short disclaimer.
export function AiOutput({
  label,
  children,
  footer,
  note = "Written by AI. It can be wrong, and it isn't medical advice.",
}: {
  label: string
  children: ReactNode
  footer?: ReactNode
  note?: string
}) {
  return (
    <section className="ai-output card" aria-label={label}>
      <p className="ai-label">{label}</p>
      {children}
      <p className="hint">{note}</p>
      {footer}
    </section>
  )
}
