'use client'

import { useState } from 'react'
import { ActivityType, getTypeName } from '@/lib/co2'

interface CoachResponse {
  answer: string
  summary: string
  recommendations: string[]
  reason: string
  sources: Array<{ title: string; url: string; name: string }>
  intent: string
  grounded: boolean
}

interface WhatIfResponse {
  scenario: string
  originalCO2: number
  newCO2: number
  savedCO2: number
  percentageSaved: number
  explanation: string
}

export default function AICarbonCoach() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [coachData, setCoachData] = useState<CoachResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // What-if simulator state
  const [simFrom, setSimFrom] = useState<ActivityType>('car')
  const [simTo, setSimTo] = useState<ActivityType>('bus')
  const [simQty, setSimQty] = useState('20')
  const [simResult, setSimResult] = useState<WhatIfResponse | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  const handleAsk = async (promptQuery?: string) => {
    const q = (promptQuery || question).trim()
    if (!q) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })

      if (!res.ok) throw new Error('Failed to consult AI Carbon Coach')
      const data = await res.json()
      setCoachData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRunSimulation = async () => {
    const qty = parseFloat(simQty)
    if (isNaN(qty) || qty <= 0) return

    setSimLoading(true)
    try {
      const res = await fetch('/api/ai/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromType: simFrom,
          toType: simTo,
          quantity: qty,
        }),
      })

      if (!res.ok) throw new Error('Simulation failed')
      const data = await res.json()
      setSimResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setSimLoading(false)
    }
  }

  return (
    <div className="card space-y-6 border-emerald-500/30 bg-gradient-to-b from-[#12231b] to-black/50" id="carbon-coach">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-950/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shadow-inner">
            🌱
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              AI Carbon Coach
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase tracking-wider">
                RAG Grounded
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Personalized decarbonization guidance grounded in authoritative UN ActNow, EPA &amp; GHG Protocol sources.
            </p>
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setQuestion('How can I reduce my carbon footprint?')
              handleAsk('How can I reduce my carbon footprint?')
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 transition-all font-medium"
          >
            3-Step Plan
          </button>
          <button
            onClick={() => {
              setQuestion('Why did my footprint increase this week?')
              handleAsk('Why did my footprint increase this week?')
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 transition-all font-medium"
          >
            Explain Footprint
          </button>
          <button
            onClick={() => {
              setQuestion('What can I do if I exceeded my weekly target?')
              handleAsk('What can I do if I exceeded my weekly target?')
            }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-emerald-300 border border-emerald-500/20 transition-all font-medium"
          >
            Target Advice
          </button>
        </div>
      </div>

      {/* Query Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask your climate coach (e.g., 'How do I cut driving emissions?')"
          className="input flex-1 font-medium text-sm py-2.5 bg-black/60 border-emerald-900/40"
          disabled={loading}
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading || !question.trim()}
          className="btn-primary text-xs py-2.5 px-6 whitespace-nowrap flex items-center gap-1.5"
        >
          {loading ? (
            <span className="animate-pulse">Analyzing…</span>
          ) : (
            <>
              <span>Ask Coach</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* Coach Output */}
      {coachData && (
        <div className="p-4 rounded-2xl bg-black/50 border border-emerald-950/80 space-y-4 animate-in fade-in duration-300">
          <div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              Personalized Guidance
            </span>
            <p className="text-sm text-gray-200 leading-relaxed font-normal">
              {coachData.answer}
            </p>
          </div>

          {/* Actionable Recommendations */}
          {coachData.recommendations.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wider block mb-2">
                Recommended Actions
              </span>
              <ul className="space-y-1.5">
                {coachData.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Traceable Sources */}
          {coachData.sources.length > 0 && (
            <div className="pt-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <span className="text-gray-400">Grounding Citations:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {coachData.sources.map((s, idx) => (
                  <a
                    key={idx}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-If Simulator Section */}
      <div className="pt-4 border-t border-emerald-950/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span> What-If Decarbonization Simulator
          </h3>
          <span className="text-[10px] text-gray-500 font-mono">Deterministic Engine</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label text-[10px]">Current Activity</label>
            <select
              value={simFrom}
              onChange={(e) => setSimFrom(e.target.value as ActivityType)}
              className="input text-xs py-2"
            >
              <option value="car">Car travel</option>
              <option value="flight">Flight</option>
              <option value="non_veg_meal">Non-veg meal</option>
              <option value="electricity">Electricity</option>
            </select>
          </div>

          <div>
            <label className="label text-[10px]">Green Alternative</label>
            <select
              value={simTo}
              onChange={(e) => setSimTo(e.target.value as ActivityType)}
              className="input text-xs py-2"
            >
              <option value="bus">Bus transit</option>
              <option value="veg_meal">Vegetarian meal</option>
              <option value="car">Car travel</option>
            </select>
          </div>

          <div>
            <label className="label text-[10px]">Quantity</label>
            <input
              type="number"
              value={simQty}
              onChange={(e) => setSimQty(e.target.value)}
              min="1"
              className="input text-xs py-2 font-mono"
              placeholder="e.g. 20"
            />
          </div>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={simLoading}
            className="btn-secondary text-xs py-2 px-3 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40"
          >
            {simLoading ? 'Simulating…' : 'Simulate Savings'}
          </button>
        </div>

        {/* Simulation Output */}
        {simResult && (
          <div className="mt-4 p-3 bg-[#0f1d16] border border-emerald-500/20 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
            <div>
              <p className="text-gray-200 font-medium">{simResult.explanation}</p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                From {simResult.originalCO2.toFixed(2)} kg → {simResult.newCO2.toFixed(2)} kg CO₂
              </p>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-black font-mono text-base">
                -{simResult.savedCO2.toFixed(2)} kg
              </span>
              <span className="block text-[10px] text-emerald-300 font-bold">
                {simResult.percentageSaved}% Reduction
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
