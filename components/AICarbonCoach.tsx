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
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden border border-emerald-500/30">
            <img src="/logo.png" alt="PlanetPulse" className="w-8 h-8 object-contain" />
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
      <div className="mt-8 pt-6 border-t border-emerald-950/40">
        <div className="bg-[#0c120e] rounded-2xl border border-emerald-500/20 p-5 shadow-lg relative overflow-hidden">
          {/* Background subtle glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="mb-5 relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <h3 className="text-sm font-black text-emerald-400 tracking-wide flex items-center gap-2">
                <span className="text-lg">⚖️</span> What-If Decarbonization Simulator
              </h3>
              <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-800">
                Deterministic Engine
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
              Curious about your impact? Select a typical activity and a green alternative to instantly calculate your exact carbon savings. Test the numbers before you commit to a lifestyle change!
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3 relative z-10 bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="flex-1 w-full relative">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider absolute -top-2 left-2 bg-[#0c120e] px-1">Current Habit</label>
              <select
                value={simFrom}
                onChange={(e) => setSimFrom(e.target.value as ActivityType)}
                className="w-full bg-transparent border border-white/10 rounded-lg text-sm py-2.5 px-3 text-gray-200 outline-none focus:border-emerald-500/50"
              >
                <option value="car">Car travel</option>
                <option value="flight">Flight</option>
                <option value="non_veg_meal">Non-veg meal</option>
                <option value="electricity">Electricity</option>
              </select>
            </div>

            <div className="text-gray-500 rotate-90 md:rotate-0 flex-shrink-0">
              <span className="block text-lg">➞</span>
            </div>

            <div className="flex-1 w-full relative">
              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider absolute -top-2 left-2 bg-[#0c120e] px-1">Green Swap</label>
              <select
                value={simTo}
                onChange={(e) => setSimTo(e.target.value as ActivityType)}
                className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-lg text-sm py-2.5 px-3 text-emerald-200 outline-none focus:border-emerald-500"
              >
                <option value="bus">Bus transit</option>
                <option value="veg_meal">Vegetarian meal</option>
                <option value="car">Carpool / Efficient Car</option>
              </select>
            </div>

            <div className="w-full md:w-28 flex-shrink-0 relative">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider absolute -top-2 left-2 bg-[#0c120e] px-1">Amount</label>
              <input
                type="number"
                value={simQty}
                onChange={(e) => setSimQty(e.target.value)}
                min="1"
                className="w-full bg-transparent border border-white/10 rounded-lg text-sm py-2.5 px-3 font-mono text-gray-200 outline-none focus:border-emerald-500/50"
                placeholder="Qty (km)"
              />
            </div>

            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={simLoading}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-5 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0 whitespace-nowrap"
            >
              {simLoading ? 'Calculating…' : 'Simulate'}
            </button>
          </div>

          {/* Simulation Output */}
          {simResult && (
            <div className="mt-4 p-4 bg-gradient-to-r from-emerald-950/60 to-[#0c120e] border border-emerald-500/30 rounded-xl flex items-center justify-between flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex-1 min-w-[200px]">
                <p className="text-gray-200 text-sm font-medium leading-relaxed">{simResult.explanation}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-gray-400">
                  <span className="line-through opacity-70">{simResult.originalCO2.toFixed(1)} kg CO₂</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-emerald-400 font-bold">{simResult.newCO2.toFixed(1)} kg CO₂</span>
                </div>
              </div>
              <div className="text-right bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20 text-emerald-400">
                <span className="block font-black font-mono text-2xl drop-shadow-sm">
                  -{simResult.savedCO2.toFixed(2)} kg
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-wider opacity-80 mt-0.5">
                  Total Saved ({simResult.percentageSaved}% less)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
