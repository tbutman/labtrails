import type { Brand } from '../core/ui/components'

export const BRAND: Brand = {
  name: 'LabTrails',
  prefix: 'lab',
  home: '/',
  sister: { name: 'BabyTrails', prefix: 'baby', url: 'https://babytrails.app', tagline: 'baby growth on WHO charts' },
  repo: 'https://github.com/tbutman/labtrails',
}

/** Where the app itself lives; the landing page is at /. */
export const APP = '/app'
