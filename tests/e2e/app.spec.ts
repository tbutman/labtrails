import { test, expect } from './fixtures'

const PASS = 'quartz meadow tulip anchor'

test('the built page carries the Content-Security-Policy', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("connect-src 'self' https://api.anthropic.com")
  expect(csp).toContain("default-src 'self'")
})

test('the demo works without a passphrase or key', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByText('A made-up person with made-up results')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sam (demo)' })).toBeVisible()
  await expect(page.getByText('Above lab range').first()).toBeVisible()

  await page.getByRole('link', { name: /^Glucose/ }).first().click()
  // Results from a US lab (mg/dL) and a UK lab (mmol/L) on one chart, in the latest test's unit.
  await expect(page.getByRole('img', { name: /Glucose in mmol\/L: 6 results/ })).toBeVisible()
  await page.getByLabel('Show in').selectOption('mg/dL')
  await expect(page.getByRole('img', { name: /Glucose in mg\/dL/ })).toBeVisible()

  await page.getByRole('link', { name: 'Summaries' }).click()
  await expect(page.getByText(/pre-written example/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Doctor' }).click()
  await expect(page.getByRole('img', { name: 'Lab results report for Sam (demo)' })).toBeVisible()
  await page.getByLabel('Show initials instead of the name').check()
  await expect(page.getByRole('img', { name: 'Lab results report for S. (.' })).toBeVisible()

  await page.getByRole('button', { name: 'Leave demo' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every blood test')
})

test('a vault: create, add a person and a report, lock, unlock', async ({ page }) => {
  await page.goto('/app')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByLabel('Passphrase again').fill(PASS)
  await page.getByRole('button', { name: 'Create the vault' }).click()
  await expect(page.getByText('Please confirm you understand')).toBeVisible()
  await page.getByLabel(/no way to reset it/).check()
  await page.getByRole('button', { name: 'Create the vault' }).click()

  await page.getByRole('link', { name: 'Add a person' }).click()
  await page.getByLabel('Name or nickname').fill('Alex Example')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('heading', { name: 'Alex Example' })).toBeVisible()

  await page.getByRole('link', { name: 'Add results' }).click()
  await page.getByLabel('Date the blood was taken').fill('2026-09-30')
  await page.getByLabel('Yes').check()
  const names = page.getByLabel('Name', { exact: true })
  const values = page.getByLabel('Value', { exact: true })
  const units = page.getByLabel('Unit', { exact: true })
  const ranges = page.getByLabel('Range', { exact: true })
  await names.nth(0).fill('Glicose')
  await values.nth(0).fill('118')
  await units.nth(0).fill('mg/dl')
  await ranges.nth(0).fill('70 - 110')
  await expect(page.getByText('Understood as Glucose')).toBeVisible()
  await names.nth(1).fill('Colesterol HDL')
  await values.nth(1).fill('52,5')
  await units.nth(1).fill('mg/dL')
  await ranges.nth(1).fill('> 40')
  await page.getByRole('button', { name: 'Save the report' }).click()
  await expect(page.getByText('Above lab range').first()).toBeVisible()
  await expect(page.getByText('52.5').first()).toBeVisible()

  // Locking hides everything; a wrong passphrase doesn't open it.
  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(page.getByText('Alex Example')).toHaveCount(0)
  await page.getByLabel('Passphrase', { exact: true }).fill('quartz meadow tulip kayak')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText("doesn't open this vault")

  // After a reload the vault is locked; the right passphrase brings everything back.
  await page.reload()
  await page.getByLabel('Passphrase', { exact: true }).fill(PASS)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await page.getByRole('link', { name: /Alex Example/ }).click()
  await expect(page.getByText('118').first()).toBeVisible()

  // Nothing readable is stored in IndexedDB.
  const raw = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('labtrails-vault')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const rows = await new Promise<unknown[]>((resolve) => {
      const r = db.transaction('records').objectStore('records').getAll()
      r.onsuccess = () => resolve(r.result)
    })
    return JSON.stringify(rows, (_k, v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v))
  })
  expect(raw.length).toBeGreaterThan(100)
  expect(raw).not.toContain('Alex Example')
  expect(raw).not.toContain('Glicose')
  expect(raw).not.toContain('2026-09-30')
})

test('the app is installable: manifest, icons and a service worker', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'LabTrails', display: 'standalone', start_url: '/app' })
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true)
  // A new version waits for the user's Reload (the core's UpdatePrompt), so it never switches mid-task.
  const sw = await (await request.get('/sw.js')).text()
  expect(sw).toContain('SKIP_WAITING')
  await page.goto('/')
  const registered = await page.evaluate(async () => !!(await navigator.serviceWorker.ready.then((r) => r.active)))
  expect(registered).toBe(true)
})

test('the app reloads offline once visited', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Try the demo' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'Sam (demo)' })).toBeVisible()
  await context.setOffline(false)
})
