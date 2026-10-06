// Every browser test checks the network allow-list: the app may only request its own origin. Tests
// that exercise AI features also allow Anthropic's API, which they answer with a mock (no real request
// ever leaves the test). Same approach as BabyTrails.

import { test as base, expect } from '@playwright/test'

export const ANTHROPIC = 'https://api.anthropic.com'

export const test = base.extend<{ allowAnthropic: boolean; requests: string[] }>({
  allowAnthropic: [false, { option: true }],
  requests: [
    async ({ page, baseURL, allowAnthropic }, use) => {
      const requests: string[] = []
      page.on('request', (request) => requests.push(request.url()))
      await use(requests)
      const allowed = new Set([new URL(baseURL!).origin, ...(allowAnthropic ? [ANTHROPIC] : [])])
      const outside = requests.filter((url) => !url.startsWith('data:') && !url.startsWith('blob:') && !allowed.has(new URL(url).origin))
      expect(outside, 'requests to origins that are not allowed').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
