import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const PASS = 'velvet canyon oyster lantern'

async function vaultWithReport(page: Page) {
  await page.goto('/app')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByLabel('Passphrase again').fill(PASS)
  await page.getByLabel(/no way to reset it/).check()
  await page.getByRole('button', { name: 'Create the vault' }).click()
  await page.getByRole('link', { name: 'Add a person' }).click()
  await page.getByLabel('Name or nickname').fill('Alex Example')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('link', { name: 'Add results' }).click()
  await page.getByLabel('Date the blood was taken').fill('2026-09-30')
  const names = page.getByLabel('Name', { exact: true })
  const values = page.getByLabel('Value', { exact: true })
  const units = page.getByLabel('Unit', { exact: true })
  const ranges = page.getByLabel('Range', { exact: true })
  // A misread glucose (811 for 118), a name the catalogue doesn't know, and a result to delete.
  await names.nth(0).fill('Glicose')
  await values.nth(0).fill('811')
  await units.nth(0).fill('mg/dL')
  await ranges.nth(0).fill('70 - 110')
  await names.nth(1).fill('GLU-X2')
  await values.nth(1).fill('5,1')
  await units.nth(1).fill('mmol/L')
  await ranges.nth(1).fill('3,9 - 5,8')
  await names.nth(2).fill('Linha a apagar')
  await values.nth(2).fill('1')
  await page.getByRole('button', { name: 'Save the report' }).click()
  await expect(page.getByText('811').first()).toBeVisible()
}

async function openReport(page: Page) {
  await page.getByRole('link', { name: 'Reports', exact: true }).first().click()
  await page.locator('summary', { hasText: 'Sep 30, 2026' }).click()
}

test('correcting, mapping, adding and deleting single results', async ({ page }) => {
  await vaultWithReport(page)
  await openReport(page)

  // Correct the misread value; the code parses it again and the flag goes away.
  await page.getByRole('link', { name: 'Correct Glicose' }).click()
  await expect(page.getByRole('heading', { name: 'Correct a result' })).toBeVisible()
  await expect(page.getByText('Understood as Glucose')).toBeVisible()
  await page.getByLabel('Value', { exact: true }).fill('118')
  await page.getByRole('button', { name: 'Save the correction' }).click()
  await expect(page.locator('details[open]')).toContainText('118')
  await expect(page.locator('details[open]')).not.toContainText('811')

  // Map the unknown name to a marker; the value keeps its decimal comma.
  await page.getByRole('link', { name: 'Correct GLU-X2' }).click()
  await expect(page.getByLabel('Value', { exact: true })).toHaveValue('5,1')
  await page.getByLabel('Not in the catalogue. Map it to').selectOption('glucose')
  await expect(page.getByText('LabTrails will remember this')).toBeVisible()
  await page.getByRole('button', { name: 'Save the correction' }).click()
  await expect(page.getByRole('row', { name: /GLU-X2/ })).not.toContainText('not mapped')
  await expect(page.getByRole('row', { name: /Linha a apagar/ })).toContainText('not mapped')

  // Add a result the AI missed.
  await page.getByRole('link', { name: 'Add a missing result' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Ferritina')
  await page.getByLabel('Value', { exact: true }).fill('48')
  await page.getByLabel('Unit', { exact: true }).fill('ng/mL')
  await expect(page.getByText('Understood as Ferritin')).toBeVisible()
  await page.getByRole('button', { name: 'Add the result' }).click()
  await expect(page.locator('details[open]')).toContainText('Ferritina')

  // Delete one result, keeping the rest of the report.
  await page.getByRole('link', { name: 'Correct Linha a apagar' }).click()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Delete this result' }).click()
  await expect(page.locator('details[open]')).not.toContainText('Linha a apagar')
  await expect(page.locator('details[open]')).toContainText('3 results')

  // The mapping is remembered for the next report printed the same way.
  await page.getByRole('link', { name: 'Enter by hand' }).click()
  await page.getByLabel('Name', { exact: true }).first().fill('GLU-X2')
  await page.getByLabel('Unit', { exact: true }).first().fill('mmol/L')
  await expect(page.getByText('Understood as Glucose (your mapping)')).toBeVisible()
})

test('the timeline: an entry shows on the chart, in the table and, when ticked, on the doctor report', async ({ page }) => {
  await vaultWithReport(page)
  // A second report, so the chart has a span for the entry to sit in.
  await page.getByRole('link', { name: 'Add results' }).click()
  await page.getByLabel('Date the blood was taken').fill('2026-12-01')
  await page.getByLabel('Name', { exact: true }).first().fill('Glicose')
  await page.getByLabel('Value', { exact: true }).first().fill('104')
  await page.getByLabel('Unit', { exact: true }).first().fill('mg/dL')
  await page.getByLabel('Range', { exact: true }).first().fill('70 - 110')
  await page.getByRole('button', { name: 'Save the report' }).click()

  await page.getByRole('link', { name: 'Timeline' }).first().click()
  await page.getByRole('link', { name: 'Add to the timeline' }).click()
  await page.getByLabel('Name').fill('Medicine X')
  await page.getByLabel('Started').fill('2026-10-15')
  await page.getByLabel('Dose (optional)').fill('100 mg')
  await page.getByLabel('Every (optional)').fill('1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Medicine X 100 mg, every day')).toBeVisible()

  await page.getByRole('link', { name: 'Overview' }).first().click()
  await page.getByRole('link', { name: /^Glucose/ }).first().click()
  await expect(page.getByRole('img', { name: /Timeline: Medicine X 100 mg, every day, from Oct 15, 2026/ })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Timeline on this chart' })).toContainText('Medicine X')

  await page.getByRole('link', { name: 'Table' }).first().click()
  await expect(page.getByRole('row', { name: /Timeline/ })).toContainText('Started Medicine X 100 mg, every day')

  await page.getByRole('link', { name: 'Doctor' }).first().click()
  await expect(page.getByRole('img', { name: /Lab results to discuss with your doctor/ })).not.toContainText('Medicine X')
  // Back inside the range is no longer included by default (only results outside the range, and trends).
  await page.getByRole('checkbox', { name: 'Glucose' }).check()
  await page.getByLabel(/Include the timeline/).check()
  await expect(page.locator('.report-sheet svg')).toContainText('Timeline: Medicine X 100 mg, every day (from Oct 15, 2026)')
})

test('dose timing: a test records when the blood was drawn relative to a timed dose', async ({ page }) => {
  await vaultWithReport(page)
  await page.getByRole('link', { name: 'Timeline' }).first().click()
  await page.getByRole('link', { name: 'Add to the timeline' }).click()
  await page.getByLabel('Name').fill('Injection Y')
  await page.getByLabel('Started').fill('2026-08-01')
  await page.getByLabel('Dose (optional)').fill('250 mg')
  await page.getByLabel('Every (optional)').fill('1')
  await page.getByLabel('Unit').selectOption('month')
  await page.getByLabel(/The timing of a blood test around a dose matters/).check()
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await openReport(page)
  await page.getByRole('link', { name: 'Edit details' }).first().click()
  const question = page.getByRole('group', { name: 'When was the blood drawn, relative to Injection Y 250 mg?' })
  await question.getByRole('radio', { name: 'Between doses' }).check()
  await page.getByLabel('Last dose before the test (optional)').fill('2026-09-01')
  await expect(page.getByText('Shown as: 29 days after the last dose of Injection Y 250 mg (every month).')).toBeVisible()
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect(page.locator('details[open]')).toContainText('Drawn 29 days after the last dose of Injection Y 250 mg (every month)')
})

test('a personal line: drawn on the chart in any unit, flagged as yours, and on the doctor report', async ({ page }) => {
  await vaultWithReport(page)
  await page.getByRole('link', { name: /^Glucose/ }).first().click()
  await page.getByRole('button', { name: 'Add a line' }).click()
  await page.getByLabel(/Upper value \(mg\/dL/).fill('700')
  await page.getByRole('button', { name: 'Save the line' }).click()
  await expect(page.getByText("My doctor's target: under 700 mg/dL.")).toBeVisible()
  // 811 is above the user's line as well as the lab's range; each flag says whose it is.
  await expect(page.getByText("Above your line (My doctor's target)")).toBeVisible()
  await expect(page.getByRole('img', { name: /Your line \(My doctor's target\): under 700/ })).toBeVisible()
  await page.getByLabel('Show in').selectOption('mmol/L')
  await expect(page.getByRole('img', { name: /Your line \(My doctor's target\): under 38\.9/ })).toBeVisible()

  await page.getByRole('link', { name: 'Overview' }).first().click()
  await expect(page.getByText('Above your line').first()).toBeVisible()
  await page.getByRole('link', { name: 'Doctor' }).first().click()
  await expect(page.locator('.report-sheet svg')).toContainText("(My doctor's target: under 38.9 mmol/L)")
})
