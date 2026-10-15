'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity } from '@/lib/supabase'
import { getWeekRange, getPreviousWeekRange } from '@/lib/week'
import { getTypeName } from '@/lib/co2'
import LoadingSpinner from '@/components/LoadingSpinner'

async function fetchPeriod(from: string, to: string): Promise<Activity[]> {
  const response = await fetch(`/api/activities?from=${from}&to=${to}`)
  if (!response.ok) throw new Error('Unable to load activity records for this report.')
  const data = await response.json()
  return Array.isArray(data.activities) ? data.activities : []
}

export default function InsightsPage() {
  const [current, setCurrent] = useState<Activity[]>([])
  const [previous, setPrevious] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const now = new Date(); const thisWeek = getWeekRange(now); const lastWeek = getPreviousWeekRange(now)
    Promise.all([fetchPeriod(thisWeek.from, thisWeek.to), fetchPeriod(lastWeek.from, lastWeek.to)])
      .then(([a, b]) => { setCurrent(a); setPrevious(b) })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load report.'))
      .finally(() => setLoading(false))
  }, [])
  const total = (rows: Activity[]) => rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.co2_kg)) ? Number(row.co2_kg) : 0), 0)
  const nowTotal = total(current); const lastTotal = total(previous)
  const sectors = current.reduce((map, row) => { map[row.type] = (map[row.type] || 0) + Number(row.co2_kg); return map }, {} as Record<string, number>)
  const top = Object.entries(sectors).sort((a,b) => b[1]-a[1])[0]
  if (loading) return <LoadingSpinner message="Preparing your report…" />
  const comparable = current.length > 0 && previous.length > 0
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:pl-28 lg:pr-8">
    <header className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">On-demand weekly report</p><h1 className="text-3xl font-semibold text-white sm:text-4xl">Insights & Reports</h1><p className="mt-2 text-sm text-gray-400">A summary of recorded activity, with gaps kept visible.</p></header>
    {error ? <section className="card text-rose-200" role="alert">{error}</section> : current.length === 0 ? <section className="card py-10 text-center"><h2 className="text-lg font-semibold text-white">No report yet</h2><p className="mt-2 text-sm text-gray-400">Log activity during this week to create a report from your own data.</p><Link href="/log" className="btn-primary mt-5 inline-flex">Log activity</Link></section> : <>
      <div className="grid gap-4 sm:grid-cols-2"><article className="card"><p className="text-xs uppercase tracking-wider text-gray-400">Recorded this week</p><p className="mt-2 text-3xl font-semibold text-white">{nowTotal.toFixed(1)} <span className="text-base text-gray-400">kg CO₂</span></p><p className="mt-1 text-xs text-gray-500">{current.length} activities logged</p></article><article className="card"><p className="text-xs uppercase tracking-wider text-gray-400">Previous week</p>{comparable ? <><p className="mt-2 text-3xl font-semibold text-white">{lastTotal.toFixed(1)} <span className="text-base text-gray-400">kg CO₂</span></p><p className="mt-1 text-xs text-gray-500">Change: {(nowTotal-lastTotal >= 0 ? '+' : '')}{(nowTotal-lastTotal).toFixed(1)} kg · both periods have records</p></> : <p className="mt-2 text-sm text-gray-400">Not enough comparable data. Both weeks need recorded activities.</p>}</article></div>
      <section className="card mt-6"><h2 className="text-lg font-semibold text-white">Known contributors</h2>{top ? <><p className="mt-3 text-sm text-gray-300">Largest among recorded categories: <strong className="text-emerald-300">{getTypeName(top[0] as never)}</strong> ({top[1].toFixed(1)} kg CO₂).</p><p className="mt-2 text-xs text-gray-500">Unlogged categories are unknown and excluded; this is not necessarily your largest source overall.</p></> : <p className="mt-3 text-sm text-gray-400">No valid category totals are available.</p>}<p className="mt-4 text-sm text-gray-400">Next step: <Link href="/footprint" className="text-emerald-300 underline">review coverage</Link> or <Link href="/coach" className="text-emerald-300 underline">ask the coach</Link>.</p></section>
    </>}
  </main>
}
