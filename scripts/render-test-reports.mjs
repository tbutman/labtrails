// Renders the fictional test reports in tests/fixtures/reports/reports.mjs: a multi-page PDF (through
// Chrome's print engine) and phone-style photos (tilted, shadowed, JPEG), plus expected.json, the rows
// a correct extraction contains. Every name and value is made up.
//
//   node scripts/render-test-reports.mjs

import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { PERSON, REPORTS, expectedRows } from '../tests/fixtures/reports/reports.mjs'

const dir = 'tests/fixtures/reports'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const css = `
@page { size: A4; margin: 0 }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1d1d1d; background: #fff }
.page { width: 210mm; height: 297mm; padding: 16mm 15mm; box-sizing: border-box; position: relative; page-break-after: always; overflow: hidden }
.page:last-child { page-break-after: auto }
.head { display: flex; justify-content: space-between; border-bottom: 2px solid #234; padding-bottom: 6px; margin-bottom: 10px }
.lab { font-size: 17px; font-weight: bold; color: #234 } .lab small { display: block; font-weight: normal; font-size: 10px; color: #555 }
.meta { font-size: 10.5px; text-align: right; line-height: 1.5 }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; background: #eef1f4; padding: 4px 6px; margin: 14px 0 4px }
table { width: 100%; border-collapse: collapse; font-size: 11px }
th { text-align: left; font-size: 9.5px; color: #444; border-bottom: 1px solid #888; padding: 3px 4px }
td { padding: 4px; border-bottom: 1px solid #e3e3e3; vertical-align: top }
td.v { font-weight: bold; white-space: nowrap } td.r { width: 38% } td.p { color: #555 }
.foot { position: absolute; bottom: 10mm; left: 15mm; right: 15mm; font-size: 8.5px; color: #777; display: flex; justify-content: space-between }
.wm { position: absolute; top: 120mm; left: 25mm; transform: rotate(-28deg); font: bold 46px Arial; color: rgba(180, 0, 0, .09); letter-spacing: 3px }`

function table(report, page, rows) {
  const prev = page.previous
  return `<table><thead><tr><th>Test</th><th>Result</th><th>Units</th><th>Reference range</th>${prev ? `<th>Previous result<br>${prev.printed}</th>` : ''}</tr></thead><tbody>
${rows.map(([name, value, unit, range, , , previous]) => `<tr><td>${esc(name)}</td><td class="v">${esc(value)}</td><td>${esc(unit)}</td><td class="r">${esc(range)}</td>${prev ? `<td class="p">${previous === null ? '' : esc(previous)}</td>` : ''}</tr>`).join('')}
</tbody></table>`
}

function pageHtml(report, page, i, n, carried) {
  const printed = report.order === 'mdy' ? `Collected: ${report.sample.printed}` : `Collection date: ${report.sample.printed}`
  return `<div class="page"><div class="wm">FICTIONAL · TEST DOCUMENT</div>
<div class="head"><div class="lab">${esc(report.lab)}<small>A fictional laboratory · test document for LabTrails</small></div>
<div class="meta">Patient: ${esc(PERSON.name)}<br>Date of birth: ${report.order === 'mdy' ? '04/12/1982' : '12/04/1982'} · Male<br>${printed}</div></div>
<h2>${esc(page.title)}${page.carryOver ? " (continued)" : ""}</h2>${table(report, page, page.rows.slice(page.carryOver ?? 0))}
${carried ? `<h2>${esc(carried.title)}</h2>${table(report, carried, carried.rows.slice(0, carried.carryOver))}` : ''}
<div class="foot"><span>Every name and value in this document is made up.</span><span>Page ${i + 1} of ${n}</span></div></div>`
}

function html(report) {
  const n = report.pages.length
  const body = report.pages.map((page, i) => pageHtml(report, page, i, n, report.pages[i + 1]?.carryOver ? report.pages[i + 1] : null)).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
}

const browser = await chromium.launch({ channel: 'chrome' })
const expected = {}
for (const report of REPORTS) {
  const page = await browser.newPage()
  await page.setContent(html(report))
  if (report.kind === 'pdf') {
    await page.pdf({ path: `${dir}/${report.file}`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  } else {
    // A photo of each page: on a desk, slightly tilted, with a shadow and uneven light.
    const pages = await page.locator('.page').all()
    for (const [i, el] of pages.entries()) {
      const png = await el.screenshot({ type: 'png' })
      const photo = await browser.newPage({ viewport: { width: 900, height: 1240 } })
      await photo.setContent(`<body style="margin:0;background:radial-gradient(circle at 30% 20%,#9a8f80,#5d554b);display:grid;place-items:center;height:100vh;overflow:hidden">
<div style="position:relative;transform:rotate(${i ? -1.4 : 1.1}deg) scale(.93);box-shadow:0 18px 40px rgba(0,0,0,.45)"><img src="data:image/png;base64,${png.toString('base64')}" style="display:block;width:800px">
<div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.18),rgba(0,0,0,.12) 70%)"></div></div></body>`)
      await photo.screenshot({ path: `${dir}/${report.files[i]}`, type: 'jpeg', quality: 80 })
      await photo.close()
    }
  }
  expected[report.id] = { files: report.file ? [report.file] : report.files, lab: report.lab, sample: report.sample, order: report.order, person: PERSON, rows: expectedRows(report) }
  await page.close()
}
await browser.close()
writeFileSync(`${dir}/expected.json`, JSON.stringify(expected, null, 2) + '\n')
console.log(`Rendered ${REPORTS.length} test reports and expected.json in ${dir}`)
