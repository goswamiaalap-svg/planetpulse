import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

// GET /api/settings
export async function GET() {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    // If row doesn't exist, return null target
    if (error.code === 'PGRST116') {
      return NextResponse.json({ weekly_target_kg: null })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ weekly_target_kg: data?.weekly_target_kg ?? null })
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  const supabase = getSupabase()

  let body: { weekly_target_kg: number | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { weekly_target_kg } = body

  if (weekly_target_kg !== null && (typeof weekly_target_kg !== 'number' || weekly_target_kg <= 0)) {
    return NextResponse.json({ error: 'weekly_target_kg must be a positive number or null' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('settings')
    .upsert({ id: 1, weekly_target_kg })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ weekly_target_kg: data?.weekly_target_kg ?? null })
}
