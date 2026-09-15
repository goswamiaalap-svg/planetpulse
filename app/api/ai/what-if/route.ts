import { NextRequest, NextResponse } from 'next/server'
import { ActivityType } from '@/lib/co2'
import { calculateWhatIf } from '@/lib/rag/simulator/whatIfEngine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: {
    fromType?: ActivityType
    toType?: ActivityType
    quantity?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 })
  }

  const { fromType, toType, quantity } = body

  if (!fromType || quantity === undefined || quantity <= 0) {
    return NextResponse.json(
      { error: 'Missing required parameters: fromType, quantity > 0' },
      { status: 400 }
    )
  }

  try {
    // Pure deterministic calculation — NO LLM arithmetic
    const result = calculateWhatIf({
      fromType,
      toType,
      quantity,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to evaluate scenario', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}
