import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ActivityType, ABSURD_THRESHOLDS, calculateCO2, getUnitLabel } from '@/lib/co2'
import { getWeekRange } from '@/lib/week'

export type ActivityEntryInput = {
  type?: unknown
  quantity?: unknown
  date?: unknown
  confirm_token?: unknown
  [key: string]: unknown
}

export type BatchEntryResult =
  | { status: 'logged'; id: string; type: ActivityType; quantity: number; unit: string; co2_kg: number; date: string }
  | { status: 'needs_confirmation'; type: ActivityType; quantity: number; unit: string; date: string; co2_kg: number; confirm_token: string }
  | { status: 'rejected'; reason: string; type?: string; quantity?: unknown; date?: string }
  | { status: 'ignored'; reason: string; type: ActivityType; quantity: number; unit: string; date: string }

export type ActivityBatchSummary = {
  week_total_kg: number
  target_kg: number | null
  percent_of_target: number | null
}

const ALLOWED_ENTRY_FIELDS = new Set(['type', 'quantity', 'date', 'confirm_token'])
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const TOKEN_TTL_MS = 10 * 60 * 1000

function confirmationSecret(): string {
  const secret = process.env.ACTIVITY_CONFIRMATION_SECRET || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  if (!secret || secret.startsWith('your_')) throw new Error('Activity confirmation signing secret is not configured')
  return secret
}

function todayISO(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function resolveActivityDate(value: unknown, now: Date = new Date(), options: { allowOutOfRange?: boolean } = {}): { date: string; reason?: never } | { date?: never; reason: string } {
  const today = todayISO(now)
  let resolved = today

  if (value !== undefined && value !== null && value !== '') {
    if (typeof value !== 'string') return { reason: 'date must be a date or weekday name' }
    const normalized = value.trim().toLowerCase().replace(/\.$/, '').replace(/^this\s+/, '')
    if (normalized === 'today' || normalized === 'now') {
      resolved = today
    } else if (normalized === 'yesterday') {
      const d = new Date(`${today}T00:00:00.000Z`)
      d.setUTCDate(d.getUTCDate() - 1)
      resolved = isoDate(d)
    } else if (/^(sun(day)?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?)$/.test(normalized)) {
      const weekday = normalized.slice(0, 3)
      const current = new Date(`${today}T00:00:00.000Z`)
      const offsetFromMonday = (current.getUTCDay() + 6) % 7
      current.setUTCDate(current.getUTCDate() - offsetFromMonday)
      const targetDay = WEEKDAYS.indexOf(weekday)
      current.setUTCDate(current.getUTCDate() + ((targetDay + 6) % 7))
      resolved = isoDate(current)
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const d = new Date(`${normalized}T00:00:00.000Z`)
      if (!Number.isFinite(d.getTime()) || isoDate(d) !== normalized) return { reason: 'date must be a valid YYYY-MM-DD date' }
      resolved = normalized
    } else {
      return { reason: 'date must be today, yesterday, a weekday in this week, or YYYY-MM-DD' }
    }
  }

  const dateTime = new Date(`${resolved}T00:00:00.000Z`).getTime()
  const todayTime = new Date(`${today}T00:00:00.000Z`).getTime()
  if (!options.allowOutOfRange && dateTime > todayTime) return { reason: 'date cannot be in the future' }
  if (!options.allowOutOfRange && todayTime - dateTime > 30 * 24 * 60 * 60 * 1000) return { reason: 'date cannot be more than 30 days old' }
  return { date: resolved }
}

type TokenPayload = { type: ActivityType; quantity: number; date: string; expires_at: number }

function signPayload(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', confirmationSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifyConfirmationToken(token: unknown, entry: Omit<TokenPayload, 'expires_at'>, now: Date): boolean {
  if (typeof token !== 'string') return false
  const [encoded, suppliedSignature, ...rest] = token.split('.')
  if (!encoded || !suppliedSignature || rest.length) return false
  try {
    const expectedSignature = createHmac('sha256', confirmationSecret()).update(encoded).digest()
    const supplied = Buffer.from(suppliedSignature, 'base64url')
    if (expectedSignature.length !== supplied.length || !timingSafeEqual(expectedSignature, supplied)) return false
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload
    return payload.type === entry.type && payload.quantity === entry.quantity && payload.date === entry.date &&
      Number.isFinite(payload.expires_at) && payload.expires_at > now.getTime()
  } catch {
    return false
  }
}

function createConfirmationToken(entry: Omit<TokenPayload, 'expires_at'>, now: Date): string {
  return signPayload({ ...entry, expires_at: now.getTime() + TOKEN_TTL_MS })
}

export function validateActivityEntry(
  input: ActivityEntryInput,
  now: Date = new Date(),
  options: { allowManualConfirmation?: boolean; allowManualDateRange?: boolean } = {}
): BatchEntryResult | { status: 'valid'; type: ActivityType; quantity: number; date: string; co2_kg: number } {
  const unknownField = Object.keys(input).find((key) => !ALLOWED_ENTRY_FIELDS.has(key) && !(options.allowManualConfirmation && key === 'confirmed'))
  if (unknownField) return { status: 'rejected', reason: `Unknown field: ${unknownField}` }

  if (typeof input.type !== 'string' || !Object.prototype.hasOwnProperty.call(ABSURD_THRESHOLDS, input.type)) {
    return { status: 'rejected', reason: 'Unsupported activity type', type: typeof input.type === 'string' ? input.type : undefined }
  }
  const type = input.type as ActivityType
  if (typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { status: 'rejected', reason: 'quantity must be a finite positive number', type, quantity: input.quantity }
  }
  const resolvedDate = resolveActivityDate(input.date, now, { allowOutOfRange: options.allowManualDateRange })
  if (!resolvedDate.date) return { status: 'rejected', reason: resolvedDate.reason || 'Invalid date', type, quantity: input.quantity }
  const date = resolvedDate.date
  const co2_kg = calculateCO2(type, input.quantity)
  const tokenPayload = { type, quantity: input.quantity, date }
  const manualConfirmed = options.allowManualConfirmation && input.confirmed === true

  if (input.confirm_token !== undefined && !verifyConfirmationToken(input.confirm_token, tokenPayload, now)) {
    return { status: 'rejected', reason: 'Confirmation token is invalid, expired, or does not match this entry', type, quantity: input.quantity, date }
  }
  if (input.quantity > ABSURD_THRESHOLDS[type] && !manualConfirmed && input.confirm_token === undefined) {
    return {
      status: 'needs_confirmation', type, quantity: input.quantity, unit: getUnitLabel(type), date, co2_kg,
      confirm_token: createConfirmationToken(tokenPayload, now),
    }
  }
  return { status: 'valid', type, quantity: input.quantity, date, co2_kg }
}

export function validateBatchShape(entries: unknown): { ok: true; entries: ActivityEntryInput[] } | { ok: false; error: string } {
  if (!Array.isArray(entries) || entries.length === 0) return { ok: false, error: 'entries must contain between 1 and 10 activities' }
  if (entries.length > 10) return { ok: false, error: 'entries cannot contain more than 10 activities' }
  if (entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    return { ok: false, error: 'each entry must be an object' }
  }
  return { ok: true, entries: entries as ActivityEntryInput[] }
}

export async function processActivityEntries(
  supabase: SupabaseClient,
  entries: ActivityEntryInput[],
  now: Date = new Date(),
  options: { allowManualConfirmation?: boolean; allowManualDateRange?: boolean } = {}
): Promise<{ results: BatchEntryResult[]; summary: ActivityBatchSummary }> {
  const results: Array<BatchEntryResult | undefined> = new Array(entries.length)
  const validRows: Array<{ index: number; value: { type: ActivityType; quantity: number; date: string; co2_kg: number } }> = []
  const seen = new Set<string>()

  entries.forEach((entry, index) => {
    const checked = validateActivityEntry(entry, now, options)
    if (checked.status !== 'valid' && checked.status !== 'needs_confirmation') {
      results[index] = checked
      return
    }
    const key = JSON.stringify([checked.type, checked.quantity, checked.date, entry.confirm_token ?? null])
    if (seen.has(key)) {
      results[index] = { status: 'ignored', reason: 'Exact duplicate in this request was ignored', type: checked.type, quantity: checked.quantity, unit: getUnitLabel(checked.type), date: checked.date }
      return
    }
    seen.add(key)
    if (checked.status === 'needs_confirmation') {
      results[index] = checked
      return
    }
    validRows.push({ index, value: checked })
  })

  if (validRows.length) {
    const { data, error } = await supabase.from('activities')
      .insert(validRows.map(({ value }) => value))
      .select('id,type,quantity,co2_kg,date')
    if (error) throw new Error(error.message)
    const inserted = data || []
    validRows.forEach(({ index, value }, rowIndex) => {
      const row = inserted[rowIndex]
      if (!row) {
        results[index] = { status: 'rejected', reason: 'Activity could not be saved', type: value.type, quantity: value.quantity, date: value.date }
        return
      }
      results[index] = {
        status: 'logged', id: row.id, type: value.type, quantity: value.quantity,
        unit: getUnitLabel(value.type), co2_kg: Number(row.co2_kg), date: value.date,
      }
    })
  }

  const { from, to } = getWeekRange(now)
  const [activityResponse, settingResponse] = await Promise.all([
    supabase.from('activities').select('co2_kg').gte('date', from).lte('date', to),
    supabase.from('settings').select('weekly_target_kg').eq('id', 1).maybeSingle(),
  ])
  if (activityResponse.error) throw new Error(activityResponse.error.message)
  if (settingResponse.error) throw new Error(settingResponse.error.message)
  const weekTotal = (activityResponse.data || []).reduce((sum, activity) => sum + Number(activity.co2_kg), 0)
  const target = settingResponse.data?.weekly_target_kg == null ? null : Number(settingResponse.data.weekly_target_kg)

  return {
    results: results.map((result) => result || { status: 'rejected', reason: 'Activity was not processed' }),
    summary: {
      week_total_kg: +weekTotal.toFixed(3),
      target_kg: target,
      percent_of_target: target && target > 0 ? Math.round((weekTotal / target) * 100) : null,
    },
  }
}
