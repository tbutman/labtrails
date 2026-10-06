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
  await page.locator('summary', { hasText: '30 Sept 2026' }).click()
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
