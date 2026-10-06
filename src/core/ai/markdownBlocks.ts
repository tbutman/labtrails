// Splits AI text into the blocks the restricted Markdown renderer supports.

export type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'ol'; items: string[] }

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (!line) {
      flush()
    } else if (heading) {
      flush()
      blocks.push({ kind: 'h', text: heading[1] })
    } else if (bullet || numbered) {
      flush()
      const kind = bullet ? 'ul' : 'ol'
      const item = (bullet ?? numbered)![1]
      const last = blocks.at(-1)
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

