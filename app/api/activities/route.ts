import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ABSURD_THRESHOLDS } from '@/lib/co2'
import { processActivityEntries, validateActivityEntry } from '@/lib/activityLogging'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

// GET /api/activities?from=YYYY-MM-DD&to=YYYY-MM-DD&type=car
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')

  let query = supabase
    .from('activities')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (type && type !== 'all') query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ activities: data })
}

// POST /api/activities
export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
  }

  const { type, quantity, date, confirmed } = body
  if (!type || quantity === undefined || !date) {
    return NextResponse.json({ error: 'Missing required fields: type, quantity, date' }, { status: 400 })
  }
  const entry = { type, quantity, date, ...(confirmed === true ? { confirmed: true } : {}) }
  const validated = validateActivityEntry(entry, new Date(), { allowManualConfirmation: true, allowManualDateRange: true })
  if (validated.status === 'rejected') return NextResponse.json({ error: validated.reason }, { status: 400 })
  if (validated.status === 'needs_confirmation') {
    return NextResponse.json({ error: "That's an unusually large entry — are you sure this is correct?", requiresConfirmation: true, threshold: ABSURD_THRESHOLDS[validated.type] }, { status: 422 })
  }

  try {
    const processed = await processActivityEntries(supabase, [entry], new Date(), { allowManualConfirmation: true, allowManualDateRange: true })
    const result = processed.results[0]
    if (result.status !== 'logged') return NextResponse.json({ error: result.status === 'rejected' ? result.reason : 'Activity was not saved' }, { status: 400 })
    return NextResponse.json({ activity: result }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save activity' }, { status: 500 })
  }
}

// DELETE /api/activities?id=<activity-id> — used by the AI receipt undo controls.
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'A valid activity id is required' }, { status: 400 })
  }

  const { data, error } = await getSupabase().from('activities').delete().eq('id', id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  return NextResponse.json({ deleted_id: data.id })
}
