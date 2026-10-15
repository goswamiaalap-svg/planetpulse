import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/routines — List all active recurring routines and templates
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/routines] Supabase read failed:', error.message)
      return NextResponse.json({ error: 'Unable to load routines' }, { status: 503 })
    }

    return NextResponse.json({ routines: data || [], usingFallback: false })
  } catch (err) {
    return NextResponse.json({ routines: [], error: String(err) }, { status: 500 })
  }
}

// POST /api/routines — Create a new recurring routine
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, type, quantity, days_of_week } = body

    if (!title || !type || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Title, type, and positive quantity are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('routines')
      .insert({
        title,
        type,
        quantity: Number(quantity),
        days_of_week: Array.isArray(days_of_week) ? days_of_week : [1, 2, 3, 4, 5],
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ routine: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
