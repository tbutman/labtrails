// Wording both apps share (CORE-13), so the same thing is said the same way.

/** "LabTrails's" reads badly; names ending in s take only an apostrophe. Prefer "the {app} server". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`
}

/** The short disclaimer under screens with numbers. `doctor`: "your doctor", "your baby's doctor". */
export function disclaimer(appName: string, doctor: string): string {
  return `${appName} keeps records and draws charts. It doesn't diagnose or give medical advice; talk to ${doctor} about anything that worries you.`
}

/** The note on demo answers and summaries. `subject`: "baby", "person". */
export function demoNote(subject: string): string {
  return `Demo: prepared in advance for this made-up ${subject}; no AI was called. Not medical advice.`
}
