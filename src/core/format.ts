// Dates in the apps' English UI: US short dates, "Sep 19, 2026" (Thomas, October 7, 2026).

const DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }

/** "Sep 19, 2026", from "2026-09-19" (a calendar date) or a full ISO timestamp (shown in local time). */
export function formatDate(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', DATE)
}

/** "Sep 19", for chart labels and compact tables. */
export function formatShortDate(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
