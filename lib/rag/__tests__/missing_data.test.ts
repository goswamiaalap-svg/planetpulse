import { buildUserContext } from '../context/userContext'
import { Activity } from '@/lib/supabase'

const activity = (overrides: Partial<Activity>): Activity => ({
  id: 'a1', type: 'car', quantity: 10, co2_kg: 2, date: '2026-10-15', created_at: '',
  ...overrides,
})

describe('missing activity data stays distinct from measured zero', () => {
  it('keeps an empty period uncalculated', () => {
    const context = buildUserContext([], null)
    expect(context.dataStatus).toBe('empty')
    expect(context.hasValidFootprint).toBe(false)
    expect(context.weeklyTotalCO2).toBe(0) // Aggregate placeholder; dataStatus says it is not a measured zero.
  })

  it('excludes records with null or invalid numeric values instead of converting them to zero', () => {
    const context = buildUserContext([
      activity({ co2_kg: null as unknown as number }),
      activity({ quantity: Number.NaN }),
    ], null)
    expect(context.dataStatus).toBe('incomplete')
    expect(context.invalidActivitiesCount).toBe(2)
    expect(context.recentActivitiesCount).toBe(0)
    expect(context.hasValidFootprint).toBe(false)
  })

  it('preserves an explicitly recorded zero as a measured zero', () => {
    const context = buildUserContext([activity({ quantity: 0.01, co2_kg: 0 })], null)
    expect(context.dataStatus).toBe('zero_measured')
    expect(context.isZeroFootprint).toBe(true)
    expect(context.invalidActivitiesCount).toBe(0)
  })

  it('does not hide invalid rows when valid activity is also present', () => {
    const context = buildUserContext([
      activity({}),
      activity({ id: 'a2', co2_kg: null as unknown as number }),
    ], null)
    expect(context.dataStatus).toBe('incomplete')
    expect(context.weeklyTotalCO2).toBe(2)
    expect(context.invalidActivitiesCount).toBe(1)
  })
})
