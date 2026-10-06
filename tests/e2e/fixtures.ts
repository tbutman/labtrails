// Every browser test checks the network allow-list: the app may only request its own origin. AI
// requests are answered by a mock and asserted separately.

import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ requests: string[] }>({
  requests: [
    async ({ page, baseURL }, use) => {
      const requests: string[] = []
      page.on('request', (request) => requests.push(request.url()))
      await use(requests)
      const allowed = new URL(baseURL!).origin
      const outside = requests.filter((url) => {
        if (url.startsWith('data:') || url.startsWith('blob:')) return false
        return new URL(url).origin !== allowed
      })
      expect(outside, 'requests to origins other than the app').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
