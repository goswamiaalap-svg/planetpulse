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
      className="card border border-emerald-500/20 bg-gradient-to-r from-[#12281e] via-[#10231a] to-[#0c1a14] shadow-lg relative overflow-hidden"
      data-testid="nudge-panel"
      role="status"
      aria-live="polite"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-xl shadow-inner">
          🤖
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-bold text-emerald-400 text-sm tracking-wide uppercase">AI Sustainability Nudge</h3>
          </div>
          {loading ? (
            <p className="text-emerald-300/80 text-sm animate-pulse">Consulting AI advisor for tailored habits…</p>
          ) : (
            <p className="text-gray-200 text-sm leading-relaxed" data-testid="nudge-message">
              {message || fallbackMessage(total, target)}
            </p>
          )}
          {error && (
            <p className="text-xs text-emerald-500/60 mt-1.5">(Using smart local heuristics template)</p>
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
