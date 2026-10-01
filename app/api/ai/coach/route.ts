import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWeekRange, getPreviousWeekRange } from '@/lib/week'
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
  let body: { question?: string; stream?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }

  const question = body.question?.trim()
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  const wantsStream = body.stream !== false || req.headers.get('accept')?.includes('text/event-stream')

  try {
    const supabase = getSupabase()
    const { from, to } = getWeekRange()
    const { from: prevFrom, to: prevTo } = getPreviousWeekRange()

    // 1. Fetch current week's activities, previous week, and settings for contextual grounding
    const [activitiesRes, prevActivitiesRes, settingsRes] = await Promise.all([
      supabase.from('activities').select('*').gte('date', from).lte('date', to),
      supabase.from('activities').select('*').gte('date', prevFrom).lte('date', prevTo),
      supabase.from('settings').select('weekly_target_kg').eq('id', 1).maybeSingle(),
    ])

    const activities: Activity[] = activitiesRes.data || []
    const prevActivities: Activity[] = prevActivitiesRes.data || []
    const weeklyTarget = settingsRes.data?.weekly_target_kg ?? null

    // 2. Build non-PII User Context with previous week comparison
    const userContext = buildUserContext(activities, weeklyTarget, prevActivities)
    const coachService = new CarbonCoachService()

    // 3. If streaming is requested, stream chunks via Server-Sent Events (SSE)
    if (wantsStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await coachService.consultCoachStream(question, userContext, (event) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            })
            controller.close()
          } catch (streamErr) {
            console.error('[POST /api/ai/coach stream error]:', streamErr)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: streamErr instanceof Error ? streamErr.message : 'Streaming failed',
                })}\n\n`
              )
            )
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming fallback
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
