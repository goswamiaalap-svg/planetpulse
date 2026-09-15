import { NextRequest, NextResponse } from 'next/server'
import { CategoryTotal } from '@/components/CO2Chart'
import { getTypeName } from '@/lib/co2'

export const dynamic = 'force-dynamic'

type NudgeRequest = {
  total: number
  target: number
  breakdown: CategoryTotal[]
}

// POST /api/nudge — Generate AI-powered sustainability nudge (DP1)
export async function POST(req: NextRequest) {
  let body: NudgeRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: fallbackMessage(0, 1) })
  }

  const { total, target, breakdown } = body

  if (!total || !target || !breakdown) {
    return NextResponse.json({ message: fallbackMessage(total ?? 0, target ?? 1) })
  }

  try {
    const message = await generateNudge(total, target, breakdown)
    return NextResponse.json(
      { message },
      {
        headers: {
          'Cache-Control': 'private, max-age=86400', // Cache for 1 day
        },
      }
    )
  } catch (err) {
    // Fallback — never throw to UI (DP1)
    console.error('[nudge] LLM call failed:', err)
    return NextResponse.json({ message: fallbackMessage(total, target) })
  }
}

async function generateNudge(
  total: number,
  target: number,
  breakdown: CategoryTotal[]
): Promise<string> {
  const pct = Math.round((total / target) * 100)
  const sortedBreakdown = [...breakdown].sort((a, b) => b.co2_kg - a.co2_kg)
  const topCategory = sortedBreakdown[0]
  const topCategoryName = topCategory ? getTypeName(topCategory.type) : 'activities'
  const topCategoryPct =
    topCategory && total > 0
      ? Math.round((topCategory.co2_kg / total) * 100)
      : 0

  const breakdownText = sortedBreakdown
    .map((c) => `${getTypeName(c.type)}: ${c.co2_kg.toFixed(2)} kg CO₂`)
    .join(', ')

  const prompt = `You are a warm, encouraging sustainability coach helping someone track their carbon footprint. They've exceeded their weekly CO₂ target.

Current week data:
- Total emissions: ${total.toFixed(1)} kg CO₂
- Weekly target: ${target} kg CO₂  
- Exceeded by: ${(total - target).toFixed(1)} kg CO₂ (${pct}% of target)
- Breakdown: ${breakdownText}
- Biggest contributor: ${topCategoryName} (${topCategoryPct}% of total)

Write a 1-2 sentence response that is:
1. Warm and encouraging (NOT guilt-tripping or shaming)
2. Specific to their actual data (mention the top category)
3. Gives one concrete, actionable suggestion for next week
4. Uses a positive, forward-looking tone

Keep it under 60 words. Do not start with "I" or "You should". Output ONLY the message, no preamble.`

  // Try OpenAI first
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey && openaiKey !== 'your_openai_api_key') {
    return await callOpenAI(prompt, openaiKey)
  }

  // Try Anthropic Claude
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey && anthropicKey !== 'your_anthropic_api_key') {
    return await callClaude(prompt, anthropicKey)
  }

  // No API key configured — use smart fallback
  return smartFallback(total, target, topCategoryName, topCategoryPct, pct)
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? fallbackMessage(0, 1)
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? fallbackMessage(0, 1)
}

function smartFallback(
  total: number,
  target: number,
  topCategory: string,
  topCategoryPct: number,
  pct: number
): string {
  const suggestions: Record<string, string> = {
    'Car travel': 'consider carpooling or taking the bus for shorter trips next week',
    'Flight': 'try a shorter route or offsetting with extra plant-based meals',
    'Bus travel': 'great that you\'re using public transit — try combining more trips',
    'Electricity': 'switch off devices on standby and consider a green energy tariff',
    'Vegetarian meal': 'fantastic plant-based choices — keep up the green eating!',
    'Non-veg meal': 'swapping 2-3 meals for veggie options next week can make a real difference',
  }
  const tip = suggestions[topCategory] || 'try one small green swap each day next week'

  return `You're at ${pct}% of your weekly target — mostly from ${topCategory} (${topCategoryPct}% of emissions). Great self-awareness! Next week, ${tip}, and you'll be right back on track.`
}

function fallbackMessage(total: number, target: number): string {
  const pct = target > 0 ? Math.round((total / target) * 100) : 0
  return `You're at ${pct}% of your weekly target (${total.toFixed(1)} kg CO₂ vs ${target} kg goal). Every sustainable choice counts — try one small green swap this week to get back on track!`
}
