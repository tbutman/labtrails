// The "what will be sent, and to whom" step before every AI request. Nothing is sent until the user
// taps Send. Apps supply the wording; the sheet always names the provider and what isn't sent.

import type { ReactNode } from 'react'
import { estimateCents, modelInfo } from './models'

export type SendSheetProps = {
  // The app's name, for "it doesn't go through <app>'s server".
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
        through {appName}'s server.
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
        Anthropic's terms say API content isn't used for training, and it's deleted within 30 days (kept up to 2 years if its safety
        systems flag it).
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

// Wraps anything the AI wrote: labelled, with the short disclaimer.
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
