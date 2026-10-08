// Accessibility: axe checks every screen against WCAG 2.1 A and AA, in the light and dark themes and at
// phone and desktop widths, and no screen may scroll sideways. Any violation fails the test, listed with the screen, the rule and the
// elements. Screens are reached by clicking through the app, since the demo lives only in memory.

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

type Found = { screen: string; rule: string; impact: string; help: string; targets: string[] }

async function check(page: Page, screen: string, found: Found[]) {
  // Let entrance transitions finish, so colours are measured at rest.
  await page.waitForTimeout(350)
  // No sideways scrolling: the page is never wider than the screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0) found.push({ screen, rule: 'page-wider-than-screen', impact: 'serious', help: `The page is ${overflow}px wider than the screen`, targets: [] })
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.passes.length, `axe ran its rules on ${screen}`).toBeGreaterThan(10)
  for (const v of results.violations)
    found.push({ screen, rule: v.id, impact: v.impact ?? '', help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) })
}

// The phone layout has a bottom bar and the desktop a top bar; click whichever is showing.
const nav = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).first().click()

async function everyScreen(page: Page, found: Found[]) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, 'landing', found)

  await page.goto('/how-flags-work')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, 'how flags work', found)

  await page.goto('/app')
  await expect(page.getByLabel('Passphrase', { exact: true })).toBeVisible()
  await check(page, 'create a vault', found)

  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'Sam (demo)' })).toBeVisible()
  await check(page, 'overview', found)

  await page.getByRole('link', { name: /^Glucose/ }).first().click()
  await expect(page.getByRole('img', { name: /Glucose in/ })).toBeVisible()
  await check(page, 'marker', found)

  await nav(page, 'Table')
  await expect(page.getByRole('table')).toBeVisible()
  await check(page, 'table', found)

  await nav(page, 'Reports')
  await page.locator('summary').first().click()
  await expect(page.getByRole('link', { name: /^Correct / }).first()).toBeVisible()
  await check(page, 'reports', found)

  await page.getByRole('link', { name: /^Correct / }).first().click()
  await expect(page.getByRole('heading', { name: 'Correct a result' })).toBeVisible()
  await check(page, 'correct a result', found)

  await nav(page, 'Reports')
  await page.getByRole('link', { name: 'Import reports' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await check(page, 'import', found)

  await nav(page, 'Reports')
  await page.locator('summary').first().click()
  await page.getByRole('link', { name: 'Edit details' }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit report details' })).toBeVisible()
  await check(page, 'edit report details', found)

  await nav(page, 'Overview')
  await page.getByRole('link', { name: 'Before your next test' }).click()
  await page.getByRole('button', { name: 'Add what was measured last time' }).click()
  await page.getByRole('radio', { name: 'Português' }).check()
  await expect(page.getByText(/^Gostaria de fazer análises a: hemoglobina, /)).toBeVisible()
  await check(page, 'before your next test', found)

  await nav(page, 'Timeline')
  await expect(page.getByText('Vitamin D3 2,000 IU, every day')).toBeVisible()
  await check(page, 'timeline', found)

  await page.getByRole('link', { name: 'Edit Vitamin D3' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Vitamin D3' })).toBeVisible()
  await check(page, 'edit a timeline entry', found)

  await nav(page, 'Summaries')
  await expect(page.getByText(/pre-written example/).first()).toBeVisible()
  await check(page, 'summaries', found)

  await page.getByRole('link', { name: 'Ask about your results' }).click()
  await page.getByRole('button', { name: /How has my glucose changed/ }).click()
  await expect(page.getByText('Demo: prepared in advance')).toBeVisible()
  await check(page, 'ask about your results', found)

  await nav(page, 'Doctor')
  await expect(page.getByRole('img', { name: /Lab results to discuss with your doctor/ })).toBeVisible()
  await check(page, 'doctor report', found)
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of ['phone', 'desktop'] as const) {
    test(`no accessibility violations: ${colorScheme}, ${width}`, async ({ page }) => {
      // Every screen with axe takes about 20s alone, so more when other tests share the machine.
      test.slow()
      await page.emulateMedia({ colorScheme })
      if (width === 'desktop') await page.setViewportSize({ width: 1280, height: 900 })
      const found: Found[] = []
      await everyScreen(page, found)
      expect(found, JSON.stringify(found, null, 2)).toEqual([])
    })
  }
}

test('keyboard and screen readers: a skip link, and each screen announced by its heading', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()

  await page.goto('/app')
  await page.getByRole('button', { name: 'Try the demo' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sam (demo)' })).toBeFocused()
  await expect(page).toHaveTitle('Sam (demo) · LabTrails')
  await nav(page, 'Reports')
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeFocused()
  await expect(page).toHaveTitle('Reports · LabTrails')
})
