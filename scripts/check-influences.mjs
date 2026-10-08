// Refetches every known-influence source (src/labs/influences-data.ts) and checks that each quote is
// still on its page, word for word. Run it by hand now and then (`node scripts/check-influences.mjs`),
// not in CI: it needs the network and no key. A quote with "…" joins a list heading and one item, so
// each part is checked on its own. Pages are fetched one at a time, because some sites refuse
// parallel requests.

import { INFLUENCES } from '../src/labs/influences-data.ts'

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    // Inline tags join their words ("<strong>high</strong>, it"); every other tag is a break.
    .replace(/<\/?(strong|b|em|i|a|span|sup|sub|abbr)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, (m) => (m === '&rsquo;' || m === '&#8217;' ? '’' : "'"))
    .replace(/&lsquo;|&#8216;/g, '‘')
    .replace(/&ldquo;|&#8220;/g, '“')
    .replace(/&rdquo;|&#8221;/g, '”')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')

const pages = new Map()
for (const i of INFLUENCES) {
  const quotes = pages.get(i.source.url) ?? []
  quotes.push(i.source.quote)
  pages.set(i.source.url, quotes)
}

let failed = 0
for (const [url, quotes] of pages) {
  let body = ''
  let status = 0
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (LabTrails quote check)' } })
    status = res.status
    body = text(await res.text())
  } catch (e) {
    status = `error: ${e.message}`
  }
  for (const quote of new Set(quotes)) {
    const ok = status === 200 && quote.split(' … ').every((part) => body.includes(part.replace(/ /g, ' ')))
    if (!ok) failed++
    console.log(`${ok ? 'ok     ' : 'MISSING'} ${status} ${url}\n        “${quote}”`)
  }
  await new Promise((r) => setTimeout(r, 1500))
}
console.log(failed ? `\n${failed} quote(s) to check by hand.` : `\nAll ${INFLUENCES.length} pairs' quotes found.`)
process.exitCode = failed ? 1 : 0
