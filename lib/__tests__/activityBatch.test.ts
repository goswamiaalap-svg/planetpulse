import type { SupabaseClient } from '@supabase/supabase-js'
import {
  processActivityEntries,
  resolveActivityDate,
  validateBatchShape,
} from '@/lib/activityLogging'

const NOW = new Date('2026-10-15T12:00:00.000Z')

function createFakeSupabase(target: number | null = 30) {
  const saved: Array<Record<string, unknown>> = []
  const insertCalls: Array<Array<Record<string, unknown>>> = []
  let id = 0
  const client = {
    from: (table: string) => ({
      insert: (rows: Array<Record<string, unknown>>) => {
        insertCalls.push(rows)
        const inserted = rows.map((row) => ({ ...row, id: `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` }))
        saved.push(...inserted)
        return { select: async () => ({ data: inserted, error: null }) }
      },
      select: () => {
        if (table === 'activities') {
          return { gte: () => ({ lte: async () => ({ data: saved.map(({ co2_kg }) => ({ co2_kg })), error: null }) }) }
        }
        return { eq: () => ({ maybeSingle: async () => ({ data: { weekly_target_kg: target }, error: null }) }) }
      },
    }),
  }
  return { client: client as unknown as SupabaseClient, saved, insertCalls }
}

describe('AI activity batch handling', () => {
  beforeEach(() => {
    process.env.ACTIVITY_CONFIRMATION_SECRET = 'test-only-long-confirmation-secret'
  })

  test('processes valid, oversized, and invalid entries independently', async () => {
    const fake = createFakeSupabase()
    const { results, summary } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 10 },
      { type: 'flight', quantity: 500000 },
      { type: 'bus', quantity: 0 },
      { type: 'bus', quantity: 5 },
    ], NOW)

    expect(results.map((result) => result.status)).toEqual(['logged', 'needs_confirmation', 'rejected', 'logged'])
    expect(results[0]).toMatchObject({ type: 'car', quantity: 10, co2_kg: 2, unit: 'km' })
    expect(results[1]).toMatchObject({ type: 'flight', quantity: 500000, co2_kg: 125000, unit: 'km' })
    expect(fake.insertCalls).toHaveLength(1)
    expect(fake.insertCalls[0]).toHaveLength(2)
    expect(summary).toEqual({ week_total_kg: 2.4, target_kg: 30, percent_of_target: 8 })
  })

  test('logs the four clear example activities with the existing calculateCO2 values', async () => {
    const fake = createFakeSupabase()
    const { results } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 12 },
      { type: 'bus', quantity: 8 },
      { type: 'veg_meal', quantity: 1 },
      { type: 'non_veg_meal', quantity: 1 },
    ], NOW)
    expect(results.map((result) => result.status)).toEqual(['logged', 'logged', 'logged', 'logged'])
    expect(results.map((result) => result.status === 'logged' ? result.co2_kg : null)).toEqual([2.4, 0.64, 0.5, 2])
    expect(fake.insertCalls).toHaveLength(1)
    expect(fake.insertCalls[0]).toHaveLength(4)
  })

  test('holds only the oversized flight while logging the car and bus entries', async () => {
    const fake = createFakeSupabase()
    const { results } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 10 },
      { type: 'flight', quantity: 500000 },
      { type: 'bus', quantity: 5 },
    ], NOW)
    expect(results.map((result) => result.status)).toEqual(['logged', 'needs_confirmation', 'logged'])
    expect(fake.insertCalls).toHaveLength(1)
    expect(fake.insertCalls[0]).toHaveLength(2)
  })

  test('ignores exact duplicates inside the batch and inserts only once', async () => {
    const fake = createFakeSupabase()
    const { results } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 12, date: 'Mon' },
      { type: 'car', quantity: 12, date: '2026-10-12' },
    ], NOW)
    expect(results.map((result) => result.status)).toEqual(['logged', 'ignored'])
    expect(fake.insertCalls).toHaveLength(1)
    expect(fake.insertCalls[0]).toHaveLength(1)
  })

  test('accepts 10 entries and rejects empty or oversized arrays', () => {
    expect(validateBatchShape(Array.from({ length: 10 }, () => ({ type: 'car', quantity: 1 }))).ok).toBe(true)
    expect(validateBatchShape(Array.from({ length: 11 }, () => ({ type: 'car', quantity: 1 }))).ok).toBe(false)
    expect(validateBatchShape([]).ok).toBe(false)
  })

  test('rejects unknown fields and invalid or out-of-range dates per entry', async () => {
    const fake = createFakeSupabase()
    const { results } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 2, extra: true },
      { type: 'car', quantity: 2, date: '2026-10-16' },
      { type: 'car', quantity: 2, date: '2026-09-01' },
    ], NOW)
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'rejected', reason: 'Unknown field: extra' }),
      expect.objectContaining({ status: 'rejected', reason: 'date cannot be in the future' }),
      expect.objectContaining({ status: 'rejected', reason: 'date cannot be more than 30 days old' }),
    ]))
    expect(fake.insertCalls).toHaveLength(0)
  })

  test('rejects a tampered confirmation token inside a mixed batch', async () => {
    const fake = createFakeSupabase()
    const first = await processActivityEntries(fake.client, [{ type: 'flight', quantity: 25000 }], NOW)
    const needsConfirmation = first.results[0]
    expect(needsConfirmation.status).toBe('needs_confirmation')
    if (needsConfirmation.status !== 'needs_confirmation') return
    const tampered = `${needsConfirmation.confirm_token.slice(0, -1)}x`
    const secondFake = createFakeSupabase()
    const { results } = await processActivityEntries(secondFake.client, [
      { type: 'car', quantity: 3 },
      { type: 'flight', quantity: 25000, confirm_token: tampered },
    ], NOW)
    expect(results.map((result) => result.status)).toEqual(['logged', 'rejected'])
    expect(secondFake.insertCalls[0]).toHaveLength(1)
  })

  test('accepts an unexpired token only for the matching type, quantity, and date', async () => {
    const firstFake = createFakeSupabase()
    const first = await processActivityEntries(firstFake.client, [{ type: 'flight', quantity: 25000, date: 'Tue' }], NOW)
    const held = first.results[0]
    expect(held.status).toBe('needs_confirmation')
    if (held.status !== 'needs_confirmation') return

    const accepted = await processActivityEntries(createFakeSupabase().client, [{
      type: 'flight', quantity: 25000, date: held.date, confirm_token: held.confirm_token,
    }], new Date(NOW.getTime() + 60_000))
    expect(accepted.results[0].status).toBe('logged')

    const expired = await processActivityEntries(createFakeSupabase().client, [{
      type: 'flight', quantity: 25000, date: held.date, confirm_token: held.confirm_token,
    }], new Date(NOW.getTime() + 11 * 60_000))
    expect(expired.results[0]).toMatchObject({ status: 'rejected', reason: 'Confirmation token is invalid, expired, or does not match this entry' })

    const mismatched = await processActivityEntries(createFakeSupabase().client, [{
      type: 'flight', quantity: 26000, date: held.date, confirm_token: held.confirm_token,
    }], NOW)
    expect(mismatched.results[0].status).toBe('rejected')
  })

  test('resolves weekday and relative dates in the Monday-start week', () => {
    expect(resolveActivityDate('Mon', NOW)).toEqual({ date: '2026-10-12' })
    expect(resolveActivityDate('this Monday', NOW)).toEqual({ date: '2026-10-12' })
    expect(resolveActivityDate('Tue', NOW)).toEqual({ date: '2026-10-13' })
    expect(resolveActivityDate('yesterday', NOW)).toEqual({ date: '2026-10-14' })
  })

  test('logs multi-day entries on their own resolved dates', async () => {
    const fake = createFakeSupabase()
    const { results } = await processActivityEntries(fake.client, [
      { type: 'car', quantity: 10, date: 'Mon' },
      { type: 'bus', quantity: 8, date: 'Tue' },
    ], NOW)
    expect(results.map((result) => result.status === 'logged' ? result.date : null)).toEqual(['2026-10-12', '2026-10-13'])
  })
})
