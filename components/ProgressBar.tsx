'use client'

import { formatWeekProgressLabel, WeekProgress } from '@/lib/week'

type Props = {
  total: number
  target: number | null
  weekProgress: WeekProgress
}

export default function ProgressBar({ total, target, weekProgress }: Props) {
  // No target set
  if (target === null || target === undefined) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-200">Weekly Target</h2>
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

  // Expected consumption based on week elapsed
  const expectedPct = weekProgress.elapsedPct
  const actualPct = target > 0 ? (total / target) * 100 : 0
  const isAheadOfPace = actualPct > expectedPct

  const barColor = isOver
    ? 'bg-rose-500 shadow-rose-500/50'
    : isAheadOfPace
    ? 'bg-amber-400 shadow-amber-400/50'
    : 'bg-emerald-400 shadow-emerald-400/50'

  const barPct = Math.min((total / target) * 100, 100)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-lg font-bold text-gray-200">Weekly Target</h2>
        {isOver && (
          <span className="text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
            <span>⚠️</span> Over target
          </span>
        )}
      </div>

      {/* Week elapsed label (DP3) */}
      <p className="text-xs text-gray-400 mb-4" data-testid="week-progress-label">
        {formatWeekProgressLabel(weekProgress)}
      </p>

      {/* Progress bar */}
      <div className="relative mb-3.5">
        <div className="w-full bg-[#0d1613] border border-emerald-950/60 rounded-full h-4 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 shadow-sm ${barColor}`}
            style={{ width: `${barPct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(barPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(barPct)}% of weekly target used`}
          />
        </div>
        {/* Pace indicator */}
        {!isOver && expectedPct < 100 && (
          <div
            className="absolute top-0 h-4 w-1 bg-white/70 rounded-full"
            style={{ left: `${expectedPct}%` }}
            title={`Expected usage at this point in the week (${expectedPct}%)`}
          />
        )}
      </div>

      {/* Numbers */}
      <div className="flex items-baseline justify-between">
        <div>
          {isOver ? (
            <p className="text-base font-bold text-rose-400" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target — over by {overBy.toFixed(1)} kg
            </p>
          ) : (
            <p className="text-base font-semibold text-gray-200" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {isAheadOfPace && !isOver
              ? `⚡ Ahead of pace — ${(actualPct - expectedPct).toFixed(0)}% over expected at this point in the week`
              : !isOver
              ? `✅ On track — ${(expectedPct - actualPct).toFixed(0)}% below expected pace`
              : ''}
          </p>
        </div>
        <span className={`text-2xl font-black ${isOver ? 'text-rose-400' : isAheadOfPace ? 'text-amber-400' : 'text-emerald-400'}`}>
          {Math.round(barPct)}%
        </span>
      </div>
    </div>
  )
}
