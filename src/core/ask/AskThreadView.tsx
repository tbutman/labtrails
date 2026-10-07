// A thread of questions and answers. AI answers are labelled, and rendered by the core's Markdown
// subset, never as HTML. Answers that couldn't be checked aren't shown.

import { Markdown } from '../ai/Markdown'
import { AiOutput } from '../ai/SendSheet'
import type { AskTurn } from './model'

export function AskThreadView({ turns, outOfScope, preparedNote }: { turns: AskTurn[]; outOfScope: string; preparedNote?: string }) {
  return (
    <div className="ask-thread">
      {turns.map((t, i) =>
        t.role === 'question' ? (
          <p key={i} className="ask-question">
            {t.text}
          </p>
        ) : t.kind === 'out-of-scope' ? (
          <div key={i} className="callout ask-out-of-scope">
            {outOfScope}
          </div>
        ) : t.kind === 'unchecked' ? (
          <div key={i} className="callout ask-unchecked">
            The app couldn't check this answer's numbers against your records, so it isn't shown. Try asking in a different way.
          </div>
        ) : (
          <AiOutput key={i} label="Answer" note={t.kind === 'prepared' ? preparedNote : undefined}>
            <Markdown text={t.text} />
          </AiOutput>
        ),
      )}
    </div>
  )
}
