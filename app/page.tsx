'use client'

import { useState, useEffect, useCallback } from 'react'
import CO2Chart, { CategoryTotal } from '@/components/CO2Chart'
import ProgressBar from '@/components/ProgressBar'
import NudgePanel from '@/components/NudgePanel'
import AICarbonCoach from '@/components/AICarbonCoach'
import LoadingSpinner from '@/components/LoadingSpinner'
import { getWeekRange, getWeekProgress, WeekProgress } from '@/lib/week'
import { ActivityType, getTypeName, getUnitLabel, CATEGORY_COLORS } from '@/lib/co2'
import { Activity } from '@/lib/supabase'
import Link from 'next/link'
import { Bot } from 'lucide-react'

type TargetFormState = {
  value: string
  saving: boolean
  saved: boolean
}

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [target, setTarget] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekProgress] = useState<WeekProgress>(getWeekProgress())
  const [targetForm, setTargetForm] = useState<TargetFormState>({
    value: '',
    saving: false,
    saved: false,
  })

  const { from, to } = getWeekRange()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [activitiesRes, settingsRes] = await Promise.all([
        fetch(`/api/activities?from=${from}&to=${to}`),
        fetch('/api/settings'),
      ])

      if (!activitiesRes.ok) throw new Error('Failed to load activities')
      if (!settingsRes.ok) throw new Error('Failed to load settings')

      const activitiesData = await activitiesRes.json()
      const settingsData = await settingsRes.json()

      setActivities(activitiesData.activities || [])
      const tgt = settingsData.weekly_target_kg
      setTarget(tgt)
      if (tgt) {
        setTargetForm((f) => ({ ...f, value: String(tgt) }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle hash scrolling after data finishes loading
  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.substring(1)
      const element = document.getElementById(id)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' })
        }, 100) // Small delay to ensure DOM layout is complete
      }
    }
  }, [loading])

  // Compute totals
  const totalCO2 = activities.reduce((sum, a) => sum + Number(a.co2_kg), 0)

  const breakdownMap: Partial<Record<ActivityType, number>> = {}
  for (const a of activities) {
    breakdownMap[a.type] = (breakdownMap[a.type] ?? 0) + Number(a.co2_kg)
  }
  const breakdown: CategoryTotal[] = Object.entries(breakdownMap).map(([type, co2_kg]) => ({
    type: type as ActivityType,
    co2_kg: +co2_kg!.toFixed(3),
  }))

  const isOver = target !== null && totalCO2 > target

  // Find top category
  const topCategory = breakdown.length > 0
    ? [...breakdown].sort((a, b) => b.co2_kg - a.co2_kg)[0]
    : null

  const handleSaveTarget = async () => {
    const val = parseFloat(targetForm.value)
    if (isNaN(val) || val <= 0) return

    setTargetForm((f) => ({ ...f, saving: true }))
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_target_kg: val }),
      })
      if (!res.ok) throw new Error('Failed to save target')
      const data = await res.json()
      setTarget(data.weekly_target_kg)
      setTargetForm((f) => ({ ...f, saving: false, saved: true }))
      setTimeout(() => setTargetForm((f) => ({ ...f, saved: false })), 3000)
    } catch {
      setTargetForm((f) => ({ ...f, saving: false }))
    }
  }

  if (loading) return <LoadingSpinner message="Loading your carbon intelligence dashboard…" />
  if (error) {
    return (
      <div className="card text-center py-16 max-w-lg mx-auto mt-12">
        <p className="text-rose-400 mb-4">⚠️ {error}</p>
        <button onClick={fetchData} className="btn-secondary">Retry</button>
      </div>
    )
  }

  return (
    <>
      {/* 1. Editorial Cinematic Hero — True full-viewport, independent of sidebar */}
      <section className="relative w-full min-h-[105vh] overflow-hidden flex flex-col items-center justify-center">
        {/* Hero Video Background — absolute, covers full viewport */}
        <div className="absolute inset-0 z-0" style={{ backgroundColor: 'hsl(201, 100%, 13%)' }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              // Fallback: hide broken video, CSS background-color shows through
              (e.target as HTMLVideoElement).style.display = 'none'
            }}
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          {/* Subtle dark overlay for text legibility against bright video */}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Bottom gradient fade — blends hero into the dark dashboard seamlessly */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[5] pointer-events-none"
          style={{
            height: '320px',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(5,7,6,0.4) 35%, rgba(5,7,6,0.8) 65%, #050706 100%)',
          }}
        />

        {/* Hero Content — Navy text, centered, with left padding for sidebar clearance */}
        <div className="relative z-10 text-center px-6 sm:px-8 lg:pl-28 max-w-[1280px] mx-auto w-full flex flex-col items-center justify-center py-24">
          {/* H1 — Instrument Serif editorial headline */}
          <h1
            className="font-display text-[48px] sm:text-[64px] md:text-[80px] font-normal text-[#0f172a] leading-[0.95] tracking-[-2.46px] opacity-0 animate-fade-rise"
          >
            See the{' '}
            <em className="not-italic">real cost</em>
            <br className="hidden sm:block" />
            {' '}of your day.
          </h1>

          {/* Sub-header */}
          <p
            className="max-w-[670px] text-base sm:text-[18px] leading-[1.625] mt-6 sm:mt-8 opacity-0 animate-fade-rise animation-delay-200"
            style={{ color: 'hsl(215, 25%, 32%)' }}
          >
            PlanetPulse turns everyday choices — travel, food, energy — into a
            real-time carbon footprint, with AI-powered guidance that helps you
            actually improve it.
          </p>

          {/* CTA buttons */}
          <div className="flex items-center gap-4 mt-10 sm:mt-12 flex-wrap justify-center opacity-0 animate-fade-rise animation-delay-400">
            <Link
              href="/log"
              className="btn-pill py-5 px-14 text-[16px] font-medium shadow-xl"
            >
              Log Your First Activity
            </Link>
            <Link
              href="#ai-coach"
              className="py-4 px-8 text-[15px] font-medium rounded-full border border-[#0f172a]/20 text-[#0f172a] hover:bg-[#0f172a]/5 transition-all duration-200 flex items-center gap-2"
            >
              <Bot className="w-5 h-5" />
              Ask AI Coach
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard Content — emerges smoothly from the hero gradient fade */}
      <div className="relative w-full px-4 sm:px-6 lg:pl-28 lg:pr-8 pt-2 pb-8 space-y-6">
        {/* Atmospheric bleed — warm gradient echo of the hero tones fading into dark base */}
        <div
          className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(45,35,28,0.12) 0%, rgba(30,25,22,0.06) 40%, transparent 100%)',
          }}
        />
        {/* 2. Stats Row: 5 compact balanced cards */}
        <div className="relative w-full rounded-2xl p-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-white/10 shadow-2xl backdrop-blur-sm z-[1]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-2">
            {/* Stat 1: Total CO2 */}
            <div className="card text-center py-4 px-3 border-white/10 hover:border-emerald-500/40 transition-all bg-black/40">
              <div className="text-[11px] font-mono font-bold text-emerald-400 mb-1">&lt; kg CO₂</div>
              <div
                className="text-2xl sm:text-3xl font-black text-white font-mono"
                data-testid="total-co2"
                aria-label={`Total CO2 this week: ${totalCO2.toFixed(2)} kilograms`}
              >
                {totalCO2.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                This Week Total
              </div>
            </div>

            {/* Stat 2: Target Limit */}
            <div className="card text-center py-4 px-3 border-white/10 hover:border-amber-500/40 transition-all bg-black/40">
              <div className="text-[11px] font-mono font-bold text-amber-400 mb-1">% TARGET</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {target ? `${Math.round((totalCO2 / target) * 100)}%` : 'None'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                Target Pace
              </div>
            </div>

            {/* Stat 3: Week Day Progress */}
            <div className="card text-center py-4 px-3 border-white/10 hover:border-teal-500/40 transition-all bg-black/40">
              <div className="text-[11px] font-mono font-bold text-teal-400 mb-1">* WEEK</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {weekProgress.dayOfWeek}/7
              </div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                Days Elapsed
              </div>
            </div>

            {/* Stat 4: Activities count */}
            <div className="card text-center py-4 px-3 border-white/10 hover:border-purple-500/40 transition-all bg-black/40">
              <div className="text-[11px] font-mono font-bold text-purple-400 mb-1"># ENTRIES</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {activities.length}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                Logged Events
              </div>
            </div>

            {/* Stat 5: Top Category */}
            <div className="card text-center py-4 px-3 border-white/10 hover:border-rose-500/40 transition-all bg-black/40 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-mono font-bold text-rose-400 mb-1">TOP SECTOR</div>
              <div className="text-lg sm:text-xl font-bold text-white truncate px-1 mt-1 font-mono">
                {topCategory ? getTypeName(topCategory.type) : 'None'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                {topCategory ? `${topCategory.co2_kg.toFixed(1)} kg` : 'Primary driver'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Horizontal Grid: Target Progress (Left) + AI Nudge (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
          {/* Left Column: Weekly Target */}
          <ProgressBar total={totalCO2} target={target} weekProgress={weekProgress} />

          {/* Right Column: AI Nudge */}
          <div className="flex flex-col justify-center">
            {isOver ? (
              <NudgePanel
                total={totalCO2}
                target={target!}
                breakdown={breakdown}
                isOver={isOver}
              />
            ) : (
              <div className="card h-full flex flex-col justify-center items-center text-center p-6 border-white/10">
                <span className="text-3xl mb-2">🌿</span>
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-1">Within Target Limit</h3>
                <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
                  You are on track with your weekly carbon target. Keep choosing green transit and plant-forward meals!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Horizontal Grid: Category Breakdown (Left) + Activities & Target Controls (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
          {/* Left 2 Cols: Category Chart & Table */}
          <div className="card lg:col-span-2">
            <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Emissions By Category</span>
              <span className="text-xs font-mono text-gray-400 font-normal">6 Factors Audit</span>
            </h2>
            {activities.length === 0 ? (
              <div className="text-center py-12 text-gray-400" data-testid="empty-state">
                <span className="text-4xl mb-3 block">🌍</span>
                <p className="font-medium">No activities logged yet this week</p>
                <p className="text-sm mt-1">
                  <Link href="/log" className="text-emerald-400 underline">Log your first activity</Link>
                </p>
              </div>
            ) : (
              <CO2Chart data={breakdown} />
            )}
          </div>

          {/* Right 1 Col: Set Target & Recent Activities */}
          <div className="space-y-6">
            {/* Target Update Form */}
            <div className="card" id="set-target">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                {target ? 'Update Target Goal' : 'Configure Weekly Target'}
              </h3>
              <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                Define your weekly CO₂ threshold in kg.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    className="input pr-10 font-mono text-sm py-2"
                    placeholder={target ? String(target) : 'e.g. 30'}
                    min="0.1"
                    step="0.5"
                    value={targetForm.value}
                    onChange={(e) => setTargetForm((f) => ({ ...f, value: e.target.value }))}
                    aria-label="Weekly CO2 target in kg"
                    data-testid="target-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold font-mono">kg</span>
                </div>
                <button
                  onClick={handleSaveTarget}
                  disabled={targetForm.saving || !targetForm.value}
                  className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
                  data-testid="save-target-button"
                >
                  {targetForm.saving ? 'Saving…' : targetForm.saved ? '✓ Set' : 'Save'}
                </button>
              </div>
            </div>

            {/* Recent Activities List */}
            {activities.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Recent Logs</h3>
                  <Link href="/history" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold hover:underline">
                    All ({activities.length}) →
                  </Link>
                </div>
                <div className="space-y-2">
                  {activities.slice(0, 4).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-white/15 transition-all text-xs"
                      data-activity-id={a.id}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[a.type] }}
                        />
                        <span className="font-semibold text-gray-200 truncate">{getTypeName(a.type)}</span>
                      </div>
                      <div className="text-right font-mono flex-shrink-0">
                        <span className="font-bold text-white">{Number(a.co2_kg).toFixed(2)} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. AI Carbon Coach (RAG Knowledge Base & Simulation) */}
        <div id="ai-coach" className="w-full scroll-mt-12 group">
          <div className="relative rounded-3xl p-1 transition-all duration-700 bg-gradient-to-r hover:from-emerald-500/30 hover:via-teal-500/20 hover:to-transparent from-emerald-500/10 via-transparent to-transparent shadow-[0_0_30px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-[2rem] blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200" />
            <div className="relative rounded-2xl bg-black/40 ring-1 ring-white/10 backdrop-blur-sm">
              <AICarbonCoach />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

