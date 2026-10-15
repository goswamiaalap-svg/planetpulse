import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/habits — List habits and weekly goals
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/habits] Supabase read failed:', error.message)
      return NextResponse.json({ error: 'Unable to load habits' }, { status: 503 })
    }

    return NextResponse.json({ habits: data || [], usingFallback: false })
  } catch (err) {
    return NextResponse.json({ habits: [], error: String(err) }, { status: 500 })
  }
}

// POST /api/habits — Create or update habit progress
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, title, category, target_action, weekly_goal_count, increment } = body

    if (id && increment) {
      // Increment habit progress
      const { data: existing } = await supabase.from('habits').select('*').eq('id', id).single()
      if (existing) {
        const newCount = (existing.completed_count || 0) + 1
        const { data, error } = await supabase
          .from('habits')
          .update({ completed_count: newCount })
          .eq('id', id)
          .select()
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ habit: data })
      }
    }

    if (!title || !category || !target_action) {
      return NextResponse.json({ error: 'Title, category, and target action are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('habits')
      .insert({
        title,
        category,
        target_action,
        weekly_goal_count: Number(weekly_goal_count) || 3,
        completed_count: 0,
        archived: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ habit: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
