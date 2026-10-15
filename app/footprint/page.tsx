'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity } from '@/lib/supabase'
import { getWeekRange } from '@/lib/week'
import { ActivityType, getTypeName, getUnitLabel, EMISSION_FACTORS } from '@/lib/co2'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function FootprintPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const period = useMemo(() => getWeekRange(), [])

  useEffect(() => {
    fetch(`/api/activities?from=${period.from}&to=${period.to}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load your activity records.')
        return response.json()
      })
      .then((data) => setActivities(Array.isArray(data.activities) ? data.activities : []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load your footprint.'))
      .finally(() => setLoading(false))
  }, [period])

  const totals = activities.reduce((acc, item) => {
    const value = Number(item.co2_kg)
    if (Number.isFinite(value) && value >= 0) acc[item.type] = (acc[item.type] || 0) + value
    return acc
  }, {} as Partial<Record<ActivityType, number>>)
  const total = Object.values(totals).reduce((sum, value) => sum + (value || 0), 0)
  const largest = Object.entries(totals).sort((a, b) => b[1]! - a[1]!)[0]
  const tracked = Object.keys(totals).length

  if (loading) return <LoadingSpinner message="Loading your footprint…" />

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:pl-28 lg:pr-8">
    <header className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Your measured activity</p>
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">My Footprint</h1>
      <p className="mt-2 text-sm text-gray-400">{period.from} – {period.to} · Activity estimates use PlanetPulse emission factors.</p>
    </header>
    {error ? <section className="card" role="alert"><p className="text-rose-300">{error}</p><button className="btn-secondary mt-4" onClick={() => location.reload()}>Retry</button></section>
      : activities.length === 0 ? <section className="card py-12 text-center"><h2 className="text-xl font-semibold text-white">Your footprint is uncalculated</h2><p className="mx-auto mt-2 max-w-lg text-sm text-gray-400">There are no activity records for this week, so there is no measured total or largest sector yet.</p><Link href="/log" className="btn-primary mt-6 inline-flex">Log an activity</Link></section>
      : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card"><p className="text-xs uppercase tracking-wider text-gray-400">Recorded total</p><p className="mt-2 text-3xl font-semibold text-white">{total.toFixed(1)} <span className="text-base text-gray-400">kg CO₂</span></p><p className="mt-1 text-xs text-gray-500">Sum of {activities.length} records in this period</p></div>
          <div className="card"><p className="text-xs uppercase tracking-wider text-gray-400">Largest recorded sector</p><p className="mt-2 text-xl font-semibold text-white">{largest ? getTypeName(largest[0] as ActivityType) : 'Not determined'}</p><p className="mt-1 text-xs text-gray-500">Largest among {tracked} tracked activity types</p></div>
          <div className="card"><p className="text-xs uppercase tracking-wider text-gray-400">Data coverage</p><p className="mt-2 text-xl font-semibold text-white">{tracked} of 6 activity types</p><p className="mt-1 text-xs text-gray-500">Unlogged types are unknown, not zero.</p></div>
        </div>
        <section className="card mt-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Recorded activity breakdown</h2>
          <div className="divide-y divide-white/10">{(Object.entries(totals) as [ActivityType, number][]).sort((a,b) => b[1]-a[1]).map(([type, value]) => <div key={type} className="flex flex-wrap items-center justify-between gap-2 py-4"><div><p className="font-medium text-gray-100">{getTypeName(type)}</p><p className="mt-1 text-xs text-gray-400">Factor: {EMISSION_FACTORS[type]} kg CO₂ per {getUnitLabel(type)}</p></div><p className="font-mono text-emerald-300">{value.toFixed(2)} kg CO₂</p></div>)}</div>
          <p className="mt-4 text-xs text-gray-500">This is a partial view of recorded activities; categories without entries are not included in the total.</p>
        </section>
      </>}
  </main>
}
