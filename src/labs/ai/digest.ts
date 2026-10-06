/** A short fingerprint (FNV-1a) of a summary's facts, so the app can tell when a summary is out of date. */
export function digest(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}
