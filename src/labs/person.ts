// Who a result belongs to, as far as reference ranges care: age on the day of the test, and sex.
// Labs print some ranges by age or sex ("40 - 49 anos: 0 - 2.5", "Homens: 13 - 17").

import type { Person } from './units/parse'

export function ageInYears(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

/** The person on a test date, for picking the right band of a printed range. */
export function personAt(profile: { dateOfBirth?: string; sex?: 'female' | 'male' } | undefined, date: string): Person {
  return {
    ...(profile?.dateOfBirth && date ? { age: ageInYears(profile.dateOfBirth, date) } : {}),
    ...(profile?.sex ? { sex: profile.sex } : {}),
  }
}
