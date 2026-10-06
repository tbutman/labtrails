// Renders AI output safely: a small Markdown subset (paragraphs, bullet and numbered lists, **bold**,
// and "#" headings shown as bold lines) turned into React elements. No HTML, links or images are ever
// created from the text; anything else is shown as typed.

import { Fragment, type ReactNode } from 'react'
import { parseBlocks } from './markdownBlocks'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="ai-text">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'ul' || b.kind === 'ol') {
          const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>)
          return b.kind === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>
        }
        if (b.kind === 'h') return <p key={i}><strong>{inline(b.text)}</strong></p>
        return <p key={i}>{inline(b.text)}</p>
      })}
    </div>
  )
}
