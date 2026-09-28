import { describe, expect, it } from 'vitest'

import { formatSessionTime, sydneyToUtc, toSydney } from './sydneyTime'

describe('Sydney time', () => {
  it('uses +10:00 in winter and +11:00 in summer', () => {
    expect(sydneyToUtc('2026-07-04', '10:00')).toBe('2026-07-04T00:00:00.000Z')
    expect(sydneyToUtc('2026-12-05', '10:00')).toBe('2026-12-04T23:00:00.000Z')
  })

  it('handles the day the clocks go forward', () => {
    // 4 October 2026: 2:00 am becomes 3:00 am.
    expect(sydneyToUtc('2026-10-04', '01:30')).toBe('2026-10-03T15:30:00.000Z')
    expect(sydneyToUtc('2026-10-04', '02:30')).toBeNull()
    expect(sydneyToUtc('2026-10-04', '03:30')).toBe('2026-10-03T16:30:00.000Z')
  })

  it('handles the day the clocks go back', () => {
    // 5 April 2026: 3:00 am becomes 2:00 am.
    expect(sydneyToUtc('2026-04-05', '10:00')).toBe('2026-04-05T00:00:00.000Z')
    expect(sydneyToUtc('2026-04-04', '10:00')).toBe('2026-04-03T23:00:00.000Z')
  })

  it('turns UTC back into the Sydney date and time', () => {
    expect(toSydney('2026-10-03T23:00:00Z')).toEqual({ date: '2026-10-04', time: '10:00' })
    expect(toSydney('2026-07-04T00:00:00Z')).toEqual({ date: '2026-07-04', time: '10:00' })
  })

  it('formats a session in Sydney time', () => {
    expect(formatSessionTime('2026-10-03T23:00:00Z', '2026-10-04T00:30:00Z')).toBe(
      'Sunday 4 October, 10:00 am to 11:30 am',
    )
  })
})
