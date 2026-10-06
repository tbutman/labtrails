// TEMPORARY until the shared core's AI renderer is copied in: renders AI text as a small Markdown
// subset (paragraphs, bullet and numbered lists, **bold**) built from React elements. Nothing is ever
// parsed as HTML, so markup in AI output shows up as text.

import type { ReactNode } from 'react'
import { parseBlocks } from './markdown'

function inline(text: string): ReactNode[] {
  // **bold** only; everything else, including anything that looks like HTML, stays literal text.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

export function SafeMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'p') return <p key={i}>{inline(b.lines.join(' '))}</p>
        const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>)
        return b.kind === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>
      })}
    </>
  )
}
