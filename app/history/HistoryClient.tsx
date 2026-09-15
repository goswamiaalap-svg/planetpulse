'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity } from '@/lib/supabase'
import { ActivityType, getTypeName, getUnitLabel, CATEGORY_COLORS, EMISSION_FACTORS } from '@/lib/co2'
import CategoryBadge from '@/components/CategoryBadge'
import LoadingSpinner from '@/components/LoadingSpinner'

const ALL_TYPES = Object.keys(EMISSION_FACTORS) as ActivityType[]

export default function HistoryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const typeParam = (searchParams.get('type') ?? 'all') as ActivityType | 'all'
  const fromParam = searchParams.get('from') ?? ''
  const toParam = searchParams.get('to') ?? ''

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<ActivityType | 'all'>(typeParam)
  const [from, setFrom] = useState(fromParam)
  const [to, setTo] = useState(toParam)

  const updateURL = useCallback(
    (newType: ActivityType | 'all', newFrom: string, newTo: string) => {
      const params = new URLSearchParams()
      if (newType !== 'all') params.set('type', newType)
      if (newFrom) params.set('from', newFrom)
      if (newTo) params.set('to', newTo)
      const query = params.toString()
      router.replace(query ? `/history?${query}` : '/history', { scroll: false })
    },
    [router]
  )

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (type !== 'all') params.set('type', type)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/activities?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load activities')
      const data = await res.json()
      setActivities(data.activities || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [type, from, to])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  const handleTypeChange = (val: ActivityType | 'all') => {
    setType(val)
    updateURL(val, from, to)
  }

  const handleFromChange = (val: string) => {
    setFrom(val)
    updateURL(type, val, to)
  }

  const handleToChange = (val: string) => {
    setTo(val)
    updateURL(type, from, val)
  }

  const handleClearFilters = () => {
    setType('all')
    setFrom('')
    setTo('')
    updateURL('all', '', '')
  }

  const hasFilters = type !== 'all' || !!from || !!to

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity History</h1>
          <p className="text-gray-500 text-sm mt-1">All-time log, newest first</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="filter-type">Activity type</label>
            <select
              id="filter-type"
              className="input"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as ActivityType | 'all')}
              aria-label="Filter by activity type"
              data-testid="filter-type"
            >
              <option value="all">All types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{getTypeName(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="filter-from">From date</label>
            <input
              id="filter-from"
              type="date"
              className="input"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              aria-label="Filter from date"
              data-testid="filter-from"
            />
          </div>

          <div>
            <label className="label" htmlFor="filter-to">To date</label>
            <input
              id="filter-to"
              type="date"
              className="input"
              value={to}
              onChange={(e) => handleToChange(e.target.value)}
              aria-label="Filter to date"
              data-testid="filter-to"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Filters active</span>
            <button
              onClick={handleClearFilters}
              className="text-xs text-emerald-600 hover:underline"
              data-testid="clear-filters"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSpinner message="Loading activities…" />
      ) : error ? (
        <div className="text-center py-16 text-red-600">⚠️ {error}</div>
      ) : activities.length === 0 && !hasFilters ? (
        <div
          className="card text-center py-16"
          data-testid="empty-state-no-activities"
        >
          <span className="text-5xl mb-4 block">🌱</span>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No activities logged yet</h2>
          <p className="text-gray-400 text-sm">
            Start tracking your carbon footprint by{' '}
            <a href="/log" className="text-emerald-600 underline">logging your first activity</a>.
          </p>
        </div>
      ) : activities.length === 0 && hasFilters ? (
        <div
          className="card text-center py-16"
          data-testid="empty-state-no-results"
        >
          <span className="text-4xl mb-4 block">🔍</span>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No activities match your filters</h2>
          <p className="text-gray-400 text-sm mb-4">
            Try adjusting the date range or activity type.
          </p>
          <button onClick={handleClearFilters} className="btn-secondary">Clear filters</button>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              {hasFilters && ' (filtered)'}
            </p>
            <p className="text-sm text-gray-500">
              Total:{' '}
              <strong className="text-gray-700">
                {activities.reduce((s, a) => s + Number(a.co2_kg), 0).toFixed(2)} kg CO₂
              </strong>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label="Activity history"
              data-testid="history-table"
            >
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="py-3 pr-4 font-medium text-gray-500">Type</th>
                  <th className="py-3 pr-4 font-medium text-gray-500">Quantity</th>
                  <th className="py-3 pr-4 font-medium text-gray-500">CO₂</th>
                  <th className="py-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    data-activity-id={a.id}
                    data-activity-type={a.type}
                    data-activity-date={a.date}
                    data-activity-co2={a.co2_kg}
                  >
                    <td className="py-3 pr-4">
                      <CategoryBadge type={a.type} size="sm" />
                    </td>
                    <td className="py-3 pr-4 text-gray-700 font-mono">
                      {Number(a.quantity).toLocaleString()}{' '}
                      <span className="text-gray-400 font-sans">{getUnitLabel(a.type)}</span>
                    </td>
                    <td className="py-3 pr-4 font-semibold" style={{ color: CATEGORY_COLORS[a.type] }}>
                      {Number(a.co2_kg).toFixed(3)} kg
                    </td>
                    <td className="py-3 text-gray-500">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
