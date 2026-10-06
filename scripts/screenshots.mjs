// Takes the demo screenshots in docs/screenshots/ for the README and case study, with the locally
// installed Google Chrome, against a running dev server (npm run dev -- --port 5191). Demo data only:
// every name and value is made up.
//
//   node scripts/screenshots.mjs [base URL, default http://localhost:5191]

import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5191'
const out = (n) => `docs/screenshots/${n}.png`
const browser = await chromium.launch({ channel: 'chrome' })

async function demo(options) {
  const page = await (await browser.newContext(options)).newPage()
  await page.goto(base)
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await page.getByRole('heading', { name: 'Sam (demo)' }).waitFor()
  await page.mouse.move(0, 0) // no hover styles in the screenshots
  return page
}

const phone = { ...devices['Pixel 7'], colorScheme: 'light' }
const desk = { viewport: { width: 1280, height: 860 }, colorScheme: 'light' }
mkdirSync('public/landing', { recursive: true })

let p = await demo(phone)
await p.screenshot({ path: out('overview') })
await p.getByRole('link', { name: /^Glucose/ }).first().click()
await p.getByRole('img', { name: /Glucose in mg\/dL/ }).waitFor()
await p.screenshot({ path: out('marker') })

p = await demo({ ...phone, colorScheme: 'dark' })
await p.getByRole('link', { name: /^Ferritin/ }).first().click()
await p.getByRole('img', { name: /Ferritin/ }).waitFor()
await p.screenshot({ path: out('marker-dark') })

p = await demo(desk)
await p.getByRole('link', { name: 'Reports', exact: true }).first().click()
await p.getByRole('link', { name: 'Import reports' }).first().click()
await p.getByRole('button', { name: 'Add the sample report' }).click()
await p.getByText('Ready', { exact: true }).waitFor()
await p.getByRole('button', { name: 'Add the sample report' }).click()
await p.getByText('Already imported').waitFor()
await p.mouse.move(0, 0)
await p.screenshot({ path: out('import-queue') })
await p.getByRole('button', { name: 'Read 1 report' }).click()
await p.getByRole('heading', { name: 'Check report 1 of 1' }).waitFor()
await p.waitForTimeout(500)
await p.screenshot({ path: out('review') })
// The landing page's showcase images come from the same shots.
await p.screenshot({ path: 'public/landing/review.png' })

p = await demo(desk)
await p.getByRole('link', { name: 'Doctor' }).first().click()
await p.locator('.report-sheet svg').screenshot({ path: out('doctor-report') })
await p.locator('.report-sheet svg').screenshot({ path: 'public/landing/doctor-report.png' })

p = await demo(desk)
await p.getByRole('link', { name: 'Table' }).first().click()
await p.screenshot({ path: out('table') })

// The landing page and the dashboard, at high resolution, for the README and portfolio.
const hi = { viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' }
const landing = await (await browser.newContext(hi)).newPage()
await landing.goto(base)
await landing.waitForTimeout(900)
await landing.screenshot({ path: out('landing') })
p = await demo(hi)
await p.waitForTimeout(300)
await p.screenshot({ path: out('dashboard') })

await browser.close()
console.log('Screenshots written to docs/screenshots/')
