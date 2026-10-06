import { readFileSync } from 'node:fs'
import { zipSync } from 'fflate'
import { test, expect } from './fixtures'

const sample = readFileSync('public/demo/sample-report.png')
// A zip like a lab's download: the report, a stray text file and macOS metadata.
const zip = Buffer.from(
  zipSync({
    'Sample report (fictional).png': new Uint8Array(sample),
    'readme.txt': new TextEncoder().encode('not a report'),
    '__MACOSX/._Sample report (fictional).png': new Uint8Array([0, 1, 2]),
  }),
)

test('importing a zip, catching duplicates at every level, keeping files to read later, editing details', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await page.getByRole('link', { name: 'Reports', exact: true }).click()

  // A zip is opened in the browser; the stray file is listed as skipped, the metadata ignored.
  await page.getByRole('link', { name: 'Import reports' }).first().click()
  await page.getByLabel('Add PDFs, photos or zip files').setInputFiles({ name: 'labs.zip', mimeType: 'application/zip', buffer: zip })
  await expect(page.getByText('labs.zip › Sample report (fictional).png')).toBeVisible()
  await expect(page.getByText("1 file couldn't be added")).toBeVisible()
  await page.getByRole('button', { name: 'Read 1 report' }).click()
  await expect(page.getByRole('heading', { name: 'Check report 1 of 1' })).toBeVisible()
  for (const box of await page.getByLabel('This matches the document').all()) await box.check()
  await page.getByRole('button', { name: /Save \d+ rows/ }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  // The same file again is caught by its fingerprint before anything is read.
  await page.getByRole('link', { name: 'Import reports' }).first().click()
  await page.getByLabel('Add PDFs, photos or zip files').setInputFiles({ name: 'labs.zip', mimeType: 'application/zip', buffer: zip })
  await expect(page.getByText('Already imported')).toBeVisible()
  await expect(page.getByRole('button', { name: /Read \d+ report/ })).toHaveCount(0)

  // Imported anyway, it's recognised as the same report, with every row already saved.
  await page.getByRole('button', { name: 'Import anyway' }).click()
  await page.getByRole('button', { name: 'Read 1 report' }).click()
  await expect(page.getByText(/This looks like your report from 15 Sept 2026/)).toBeVisible()
  await expect(page.getByText(/rows already saved, left out/)).toBeVisible()
  await page.getByRole('button', { name: 'Mark as read and continue' }).click()
  await expect(page.getByRole('heading', { name: 'Import finished' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // A file kept without reading waits under "Not read yet".
  await page.getByRole('link', { name: 'Import reports' }).first().click()
  await page.getByLabel('Add PDFs, photos or zip files').setInputFiles('public/icons/icon-512.png')
  await page.getByRole('button', { name: 'Keep without reading for now' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Not read yet · 1')).toBeVisible()
  await expect(page.getByText('icon-512.png')).toBeVisible()

  // A report's details can be changed after it's saved.
  await page.getByText('15 Sept 2026').first().click()
  await page.getByRole('link', { name: 'Edit details' }).first().click()
  await page.getByLabel('Lab (optional)').fill('Another lab (fictional)')
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect(page.getByText(/Another lab \(fictional\)/)).toBeVisible()
})
