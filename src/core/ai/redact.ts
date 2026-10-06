// Replaces people's names in text sent to the AI with a placeholder: whole words, any case, accented
// letters included ("joão" and "João" both match). Apps pass every name and nickname they know.

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function redactNames(text: string, names: (string | undefined)[], placeholder: string): string {
  const words = names
    .flatMap((n) => (n ?? '').split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
  if (!words.length) return text
  // \p{L} so names with accents are matched as whole words, not inside other words.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  return text.replace(pattern, placeholder)
}
