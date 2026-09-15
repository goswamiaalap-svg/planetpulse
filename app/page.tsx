'use client'

import { useState, useEffect, useCallback } from 'react'
import CO2Chart, { CategoryTotal } from '@/components/CO2Chart'
import ProgressBar from '@/components/ProgressBar'
import NudgePanel from '@/components/NudgePanel'
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

  if (loading) return <LoadingSpinner message="Loading your carbon dashboard…" />
  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">⚠️ {error}</p>
        <button onClick={fetchData} className="btn-secondary">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">This Week&apos;s Footprint</h1>
          <p className="text-gray-500 text-sm mt-1">
            {from} → {to} · ISO week (Mon–Sun)
          </p>
        </div>
        <Link href="/log" className="btn-primary hidden sm:inline-flex items-center gap-2">
          <span>+</span> Log Activity
        </Link>
      </div>

      {/* Total CO2 hero */}
      <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex items-end gap-2">
          <span
            className="text-5xl font-black text-emerald-700"
            data-testid="total-co2"
            aria-label={`Total CO2 this week: ${totalCO2.toFixed(2)} kilograms`}
          >
            {totalCO2.toFixed(2)}
          </span>
          <span className="text-xl text-emerald-600 mb-1 font-medium">kg CO₂</span>
        </div>
        <p className="text-emerald-600 text-sm mt-1">Total this week</p>
      </div>

      {/* Progress bar */}
      <ProgressBar total={totalCO2} target={target} weekProgress={weekProgress} />

      {/* Nudge panel (only when over target) */}
      {isOver && (
        <NudgePanel
          total={totalCO2}
          target={target!}
          breakdown={breakdown}
          isOver={isOver}
        />
      )}

      {/* Chart + breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">By Category</h2>
        {activities.length === 0 ? (
          <div
            className="text-center py-12 text-gray-400"
            data-testid="empty-state"
          >
            <span className="text-4xl mb-3 block">🌍</span>
            <p className="font-medium">No activities logged yet this week</p>
            <p className="text-sm mt-1">
              <Link href="/log" className="text-emerald-600 underline">Log your first activity</Link> to see your footprint.
            </p>
          </div>
        ) : (
          <CO2Chart data={breakdown} />
        )}
      </div>

      {/* Set weekly target */}
      <div className="card" id="set-target">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          {target ? 'Update Weekly Target' : 'Set Weekly Target'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          How many kg of CO₂ do you want to stay under this week?
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="number"
              className="input pr-12"
              placeholder={target ? String(target) : 'e.g. 20'}
              min="0.1"
              step="0.5"
              value={targetForm.value}
              onChange={(e) => setTargetForm((f) => ({ ...f, value: e.target.value }))}
              aria-label="Weekly CO2 target in kg"
              data-testid="target-input"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
          </div>
          <button
            onClick={handleSaveTarget}
            disabled={targetForm.saving || !targetForm.value}
            className="btn-primary"
            data-testid="save-target-button"
          >
            {targetForm.saving ? 'Saving…' : targetForm.saved ? '✅ Saved!' : 'Save target'}
          </button>
        </div>
      </div>

      {/* Recent activities (this week) */}
      {activities.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">This Week&apos;s Activities</h2>
            <Link href="/history" className="text-sm text-emerald-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {activities.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                data-activity-id={a.id}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[a.type] }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{getTypeName(a.type)}</p>
                    <p className="text-xs text-gray-400">{a.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">
                    {Number(a.co2_kg).toFixed(3)} kg CO₂
                  </p>
                  <p className="text-xs text-gray-400">
                    {Number(a.quantity)} {getUnitLabel(a.type)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {activities.length > 5 && (
            <p className="text-sm text-gray-400 text-center mt-3">
              +{activities.length - 5} more —{' '}
              <Link href="/history" className="text-emerald-600 hover:underline">view all in history</Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

