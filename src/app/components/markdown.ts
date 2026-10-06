// Splits AI text into paragraphs and lists for SafeMarkdown. Plain text in, plain text out: nothing
// here ever becomes HTML.

export type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] }

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const last = blocks.at(-1)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      const item = (bullet ?? numbered)![1]
      if (last?.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else if (line.trim() === '') {
      blocks.push({ kind: 'p', lines: [] })
    } else if (last?.kind === 'p') {
      last.lines.push(line)
    } else {
      blocks.push({ kind: 'p', lines: [line] })
    }
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0))
}
