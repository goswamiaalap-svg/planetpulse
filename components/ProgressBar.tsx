'use client'

import { formatWeekProgressLabel, WeekProgress } from '@/lib/week'

type Props = {
  total: number
  target: number | null
  weekProgress: WeekProgress
}

export default function ProgressBar({ total, target, weekProgress }: Props) {
  // No target set
  if (target === null || target === undefined || target <= 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-200 uppercase tracking-wider">Weekly Target</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm">
            No weekly target set.{' '}
            <a href="#set-target" className="text-emerald-400 font-medium underline underline-offset-2 hover:text-emerald-300">
              Set a target
            </a>{' '}
            to track your pace.
          </p>
        </div>
      </div>
    )
  }

  const isOver = total > target
  const overBy = isOver ? +(total - target).toFixed(3) : 0
  const realPct = Math.round((total / target) * 100)
  const pctOver = Math.round(((total - target) / target) * 100)

  // Expected consumption based on week elapsed
  const expectedPct = weekProgress.elapsedPct
  const actualPct = (total / target) * 100
  const isAheadOfPace = actualPct > expectedPct

  // Visual fill is strictly capped at 100% width
  const visualFillPct = Math.min(Math.max(actualPct, 0), 100)

  const barColor = isOver
    ? 'bg-rose-500 shadow-rose-500/50'
    : isAheadOfPace
    ? 'bg-amber-400 shadow-amber-400/50'
    : 'bg-emerald-400 shadow-emerald-400/50'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-base font-bold text-gray-200 uppercase tracking-wider">Weekly Target Pace</h2>
        {isOver && (
          <span className="text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
            <span>⚠️</span> Over target
          </span>
        )}
      </div>

      {/* Week elapsed label (DP3) */}
      <p className="text-xs text-gray-400 mb-3" data-testid="week-progress-label">
        {formatWeekProgressLabel(weekProgress)}
      </p>

      {/* Progress bar — strictly capped at 100% width */}
      <div className="relative mb-3.5">
        <div className="w-full bg-[#0d1613] border border-emerald-950/60 rounded-full h-4 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 shadow-sm ${barColor}`}
            style={{ width: `${visualFillPct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(visualFillPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${realPct}% of weekly target used`}
          />
        </div>
        {/* Expected pace tick */}
        {!isOver && expectedPct < 100 && (
          <div
            className="absolute top-0 h-4 w-1 bg-white/70 rounded-full pointer-events-none"
            style={{ left: `${Math.min(expectedPct, 100)}%` }}
            title={`Expected usage at this point in the week (${expectedPct}%)`}
          />
        )}
      </div>

      {/* Target numbers & exact percentage text */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          {isOver ? (
            <p className="text-sm sm:text-base font-bold text-rose-400" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target — {realPct}% of target ({pctOver}% over)
            </p>
          ) : (
            <p className="text-sm sm:text-base font-semibold text-gray-200" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {isOver
              ? `Exceeded weekly ceiling by ${overBy.toFixed(1)} kg CO₂`
              : isAheadOfPace
              ? `⚡ Ahead of pace — ${(actualPct - expectedPct).toFixed(0)}% over expected at this point in the week`
              : `✅ On track — ${(expectedPct - actualPct).toFixed(0)}% below expected pace`}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-2xl sm:text-3xl font-black font-mono ${isOver ? 'text-rose-400' : isAheadOfPace ? 'text-amber-400' : 'text-emerald-400'}`}>
            {realPct}%
          </span>
          <span className="block text-[10px] uppercase font-bold text-gray-500">
            {isOver ? 'Exceeded' : 'Consumed'}
          </span>
        </div>
      </div>
    </div>
  )
}
