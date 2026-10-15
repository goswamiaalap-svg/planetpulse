import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processActivityEntries, validateBatchShape } from '@/lib/activityLogging'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
}

export async function POST(req: NextRequest) {
  let body: { entries?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
  }
  if (Object.keys(body || {}).some((key) => key !== 'entries')) {
    return NextResponse.json({ error: 'Unknown field in activity batch request' }, { status: 400 })
  }
  const shape = validateBatchShape(body?.entries)
  if (!shape.ok) return NextResponse.json({ error: shape.error }, { status: 400 })

  try {
    const { results, summary } = await processActivityEntries(getSupabase(), shape.entries)
    return NextResponse.json({ results, ...summary })
  } catch (error) {
    console.error('[POST /api/activities/batch]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process activity batch' }, { status: 500 })
  }
}
