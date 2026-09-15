import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWeekRange } from '@/lib/week'
import { buildUserContext } from '@/lib/rag/context/userContext'
import { CarbonCoachService } from '@/lib/rag/services/carbonCoachService'
import { Activity } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

export async function POST(req: NextRequest) {
  let body: { question?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }

  const question = body.question?.trim()
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    const { from, to } = getWeekRange()

    // 1. Fetch current week's activities and settings for contextual grounding
    const [activitiesRes, settingsRes] = await Promise.all([
      supabase.from('activities').select('*').gte('date', from).lte('date', to),
      supabase.from('settings').select('weekly_target_kg').eq('id', 1).maybeSingle(),
    ])

    const activities: Activity[] = activitiesRes.data || []
    const weeklyTarget = settingsRes.data?.weekly_target_kg ?? null

    // 2. Build non-PII User Context
    const userContext = buildUserContext(activities, weeklyTarget)

    // 3. Consult Carbon Coach Service
    const coachService = new CarbonCoachService()
    const response = await coachService.consultCoach(question, userContext)

    return NextResponse.json(response)
  } catch (err) {
    console.error('[POST /api/ai/coach] Error:', err)
    return NextResponse.json(
      {
        error: 'Failed to process Carbon Coach consultation',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
