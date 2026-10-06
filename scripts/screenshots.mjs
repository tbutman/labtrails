// Takes the demo screenshots in docs/screenshots/ for the README and case study, with the locally
// installed Google Chrome, against a running dev server (npm run dev -- --port 5191). Demo data only:
// every name and value is made up.
//
//   node scripts/screenshots.mjs [base URL, default http://localhost:5191]

import { chromium, devices } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5191'
const out = (n) => `docs/screenshots/${n}.png`
const browser = await chromium.launch({ channel: 'chrome' })

async function demo(options) {
  const page = await (await browser.newContext(options)).newPage()
  await page.goto(base)
  await page.getByRole('button', { name: 'Open the demo' }).click()
  await page.getByRole('heading', { name: 'Sam (demo)' }).waitFor()
  return page
}

const phone = { ...devices['Pixel 7'], colorScheme: 'light' }
const desk = { viewport: { width: 1280, height: 860 }, colorScheme: 'light' }

let p = await demo(phone)
await p.screenshot({ path: out('overview') })
await p.getByRole('link', { name: /^Glucose/ }).click()
await p.getByRole('img', { name: /Glucose in mg\/dL/ }).waitFor()
await p.screenshot({ path: out('marker') })

p = await demo({ ...phone, colorScheme: 'dark' })
await p.getByRole('link', { name: /^Ferritin/ }).click()
await p.getByRole('img', { name: /Ferritin/ }).waitFor()
await p.screenshot({ path: out('marker-dark') })

p = await demo(desk)
await p.getByRole('link', { name: 'Reports' }).click()
await p.getByRole('link', { name: 'Read a report with AI' }).click()
await p.getByRole('button', { name: 'Use the sample report' }).click()
await p.getByRole('button', { name: 'Show the review step' }).click()
await p.getByText('Unsure: check carefully').waitFor()
await p.waitForTimeout(500)
await p.screenshot({ path: out('review') })

p = await demo(desk)
await p.getByRole('link', { name: 'For your doctor' }).click()
await p.locator('.report-sheet').screenshot({ path: out('doctor-report') })

p = await demo(desk)
await p.getByRole('link', { name: 'Table' }).click()
await p.screenshot({ path: out('table') })

await browser.close()
console.log('Screenshots written to docs/screenshots/')
