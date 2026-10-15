import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/feedback — Save recommendation feedback (accept, dismiss, complete)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { recommendation, action, context_category } = body

    if (!recommendation || !action) {
      return NextResponse.json({ error: 'Recommendation and action are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('recommendation_feedback')
      .insert({
        recommendation,
        action,
        context_category: context_category || null,
      })
      .select()
      .single()

    if (error) {
      console.warn('[POST /api/feedback] Supabase insert notice:', error.message)
      // Return ok in dev/fallback mode
      return NextResponse.json({ success: true, saved: false, reason: error.message })
    }

    return NextResponse.json({ success: true, feedback: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
