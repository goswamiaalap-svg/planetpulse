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
    <div className="space-y-6">
      {/* 1. Cinematic Hero Section with improved vertical spacing */}
      <section className="text-center pt-8 pb-6 max-w-3xl mx-auto flex flex-col items-center">
        {/* Trust pill row */}
        <div className="inline-flex items-center gap-2 bg-[#28282a]/80 backdrop-blur-md border border-white/20 rounded-full py-1 px-3.5 mb-3 shadow-lg">
          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
            🌱
          </span>
          <span className="text-[11px] font-medium tracking-wide text-gray-200">
            Real-Time Carbon Footprint Intelligence • Climate Tech
          </span>
        </div>

        {/* Big Bold Headline with compact margins */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white leading-none mb-2.5 drop-shadow-md">
          PLANETPULSE
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-teal-200">
            CARBON AI TRACKER
          </span>
        </h1>

        <p className="text-gray-300 text-xs sm:text-sm max-w-lg leading-relaxed mb-4 font-normal">
          Automated weekly CO₂ footprint tracking for daily mobility, diet, and energy. Real-time AI sustainability insights &amp; statutory audit.
        </p>

        {/* Action button */}
        <Link
          href="/log"
          className="bg-white hover:bg-gray-100 text-gray-950 font-bold px-7 py-2.5 rounded-full text-sm shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mb-4"
        >
          <span>Inspect &amp; Log Activity</span>
          <span className="text-base">→</span>
        </Link>

        {/* Layout improvement 2: Thin horizontal category-breakdown strip */}
        {totalCO2 > 0 && breakdown.length > 0 && (
          <div className="w-full max-w-xl mx-auto mt-1 mb-2">
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-white/10 border border-white/15 shadow-inner">
              {breakdown.map((b) => {
                const sharePct = (b.co2_kg / totalCO2) * 100
                return (
                  <div
                    key={b.type}
                    style={{
                      width: `${sharePct}%`,
                      backgroundColor: CATEGORY_COLORS[b.type],
                    }}
                    title={`${getTypeName(b.type)}: ${b.co2_kg.toFixed(1)} kg (${sharePct.toFixed(1)}%)`}
                    className="h-full transition-all duration-500 hover:opacity-90"
                  />
                )
              })}
            </div>
            {/* Category micro-legend matching dark theme accents */}
            <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-300">
              {breakdown.map((b) => (
                <span key={b.type} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[b.type] }}
                  />
                  <span>{getTypeName(b.type)}</span>
                  <span className="text-gray-400 font-mono text-[10px]">
                    {((b.co2_kg / totalCO2) * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. Stats Row: 5 compact balanced cards with subtle gradient backdrop */}
      <div className="relative max-w-5xl mx-auto rounded-2xl p-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-white/10 shadow-2xl backdrop-blur-sm">
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

          {/* Stat 5: Top Category this week (Balances row on wider viewports) */}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto items-stretch">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
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
      <div id="ai-coach" className="max-w-5xl mx-auto scroll-mt-12 group">
        <div className="relative rounded-3xl p-1 transition-all duration-700 bg-gradient-to-r hover:from-emerald-500/30 hover:via-teal-500/20 hover:to-transparent from-emerald-500/10 via-transparent to-transparent shadow-[0_0_30px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-[2rem] blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200" />
          <div className="relative rounded-2xl bg-black/40 ring-1 ring-white/10 backdrop-blur-sm">
            <AICarbonCoach />
          </div>
        </div>
      </div>
    </div>
  )
}
