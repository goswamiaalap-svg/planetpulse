'use client'

import { useEffect, useState } from 'react'
import { CategoryTotal } from './CO2Chart'

type Props = {
  total: number
  target: number
  breakdown: CategoryTotal[]
  isOver: boolean
}

export default function NudgePanel({ total, target, breakdown, isOver }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Generate nudge on mount or when values change meaningfully
  useEffect(() => {
    if (!isOver) return

    // Check session cache (per DP1: once per day per session)
    const cacheKey = `nudge_${new Date().toDateString()}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setMessage(cached)
      return
    }

    setLoading(true)
    setError(false)

    fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total, target, breakdown }),
    })
      .then((r) => r.json())
      .then((data) => {
        const msg = data.message || fallbackMessage(total, target)
        setMessage(msg)
        sessionStorage.setItem(cacheKey, msg)
      })
      .catch(() => {
        const fallback = fallbackMessage(total, target)
        setMessage(fallback)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [isOver, total, target, breakdown])

  if (!isOver) return null

  return (
    <div
      className="card border-l-4 border-amber-400 bg-amber-50"
      data-testid="nudge-panel"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🌱</span>
        <div>
          <h3 className="font-semibold text-amber-800 mb-1">Sustainability Nudge</h3>
          {loading ? (
            <p className="text-amber-700 text-sm animate-pulse">Generating personalized insight…</p>
          ) : (
            <p className="text-amber-700 text-sm leading-relaxed" data-testid="nudge-message">
              {message || fallbackMessage(total, target)}
            </p>
          )}
          {error && (
            <p className="text-xs text-amber-500 mt-1">(AI unavailable — showing template message)</p>
          )}
        </div>
      </div>
    </div>
  )
}

function fallbackMessage(total: number, target: number): string {
  const pct = Math.round((total / target) * 100)
  return `You're at ${pct}% of your weekly target (${total.toFixed(1)} kg CO₂ vs ${target} kg goal). Every sustainable choice counts — consider swapping one car trip for public transit, or trying a veggie meal this week.`
}
