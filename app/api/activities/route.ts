import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ActivityType, calculateCO2, ABSURD_THRESHOLDS } from '@/lib/co2'

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

  let body: { type: ActivityType; quantity: number; co2_kg?: number; date: string; confirmed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, quantity, date, confirmed } = body

  if (!type || quantity === undefined || !date) {
    return NextResponse.json({ error: 'Missing required fields: type, quantity, date' }, { status: 400 })
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 })
  }

  // DP2: Server-side absurd input guard
  const threshold = ABSURD_THRESHOLDS[type]
  if (threshold && quantity > threshold && !confirmed) {
    return NextResponse.json(
      {
        error: "That's an unusually large entry — are you sure this is correct?",
        requiresConfirmation: true,
        threshold,
      },
      { status: 422 }
    )
  }

  // Always compute co2_kg server-side (canonical source of truth)
  const co2_kg = calculateCO2(type, quantity)

  const { data, error } = await supabase
    .from('activities')
    .insert({ type, quantity, co2_kg, date })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ activity: data }, { status: 201 })
}
