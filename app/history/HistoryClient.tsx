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

  const handleTypeChange = (newType: ActivityType | 'all') => {
    setType(newType)
    updateURL(newType, from, to)
  }

  const handleFromChange = (newFrom: string) => {
    setFrom(newFrom)
    updateURL(type, newFrom, to)
  }

  const handleToChange = (newTo: string) => {
    setTo(newTo)
    updateURL(type, from, newTo)
  }

  const handleClearFilters = () => {
    setType('all')
    setFrom('')
    setTo('')
    router.replace('/history', { scroll: false })
  }

  const isFiltered = type !== 'all' || Boolean(from) || Boolean(to)
  const totalCO2 = activities.reduce((sum, a) => sum + Number(a.co2_kg), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-100 tracking-tight">Activity History</h1>
        <p className="text-gray-400 text-sm mt-1">Browse, filter, and audit your logged carbon footprints</p>
      </div>

      {/* Filter controls */}
      <div className="card space-y-4" data-testid="filter-controls">
        <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Filter Activities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Type filter */}
          <div>
            <label htmlFor="filter-type" className="label">Activity Type</label>
            <select
              id="filter-type"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as ActivityType | 'all')}
              className="input font-medium"
              data-testid="filter-type"
            >
              <option value="all">All types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getTypeName(t)}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label htmlFor="filter-from" className="label">From Date</label>
            <input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => handleFromChange(e.target.value)}
              className="input font-mono"
              data-testid="filter-from"
            />
          </div>

          {/* Date to */}
          <div>
            <label htmlFor="filter-to" className="label">To Date</label>
            <input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => handleToChange(e.target.value)}
              className="input font-mono"
              data-testid="filter-to"
            />
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between pt-3 border-t border-emerald-950/60">
            <span className="text-xs text-gray-400">Filters currently active</span>
            <button
              onClick={handleClearFilters}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
              data-testid="clear-filters"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Summary stats for current filter */}
      {!loading && activities.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-400 px-1 font-medium">
          <span>Showing {activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
          <span>
            Total:{' '}
            <strong className="font-mono font-bold text-emerald-400">{totalCO2.toFixed(3)} kg CO₂</strong>
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading activity history…" />
      ) : error ? (
        <div className="card text-center py-12">
          <p className="text-rose-400 mb-4">⚠️ {error}</p>
          <button onClick={fetchActivities} className="btn-secondary">Retry</button>
        </div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-16" data-testid="empty-state">
          <span className="text-5xl mb-4 block">🔍</span>
          {isFiltered ? (
            <>
              <h3 className="text-lg font-bold text-gray-200 mb-1">No activities match your filters</h3>
              <p className="text-gray-400 text-sm mb-4">
                Try widening your date range or selecting a different activity type.
              </p>
              <button onClick={handleClearFilters} className="btn-secondary text-sm">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-200 mb-1">No activities logged yet</h3>
              <p className="text-gray-400 text-sm mb-4">
                Log your first travel, meal, or electricity activity to get started.
              </p>
              <a href="/log" className="btn-primary inline-block text-sm">
                Log an activity
              </a>
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0 border-emerald-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="history-table">
              <thead>
                <tr className="border-b border-emerald-950/80 bg-[#0d1613] text-gray-400 text-left">
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Type</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Quantity</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase text-right">CO₂ (kg)</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase">Date</th>
                  <th className="py-3 px-4 font-semibold text-xs uppercase text-gray-500">Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/40">
                {activities.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-emerald-950/20 transition-colors"
                    data-activity-id={a.id}
                    data-activity-type={a.type}
                    data-activity-date={a.date}
                    data-activity-co2={Number(a.co2_kg).toFixed(3)}
                  >
                    <td className="py-3.5 px-4">
                      <CategoryBadge type={a.type} />
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-200">
                      {Number(a.quantity)} {getUnitLabel(a.type)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      {Number(a.co2_kg).toFixed(3)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300 font-mono text-xs">{a.date}</td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
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
