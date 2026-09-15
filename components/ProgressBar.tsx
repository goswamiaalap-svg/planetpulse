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
          <h2 className="text-lg font-semibold text-gray-800">Weekly Target</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">
            No weekly target set.{' '}
            <a href="#set-target" className="text-emerald-600 font-medium underline underline-offset-2">
              Set a target
            </a>{' '}
            to track your pace.
          </p>
        </div>
      </div>
    )
  }

  const percentage = target > 0 ? Math.min((total / target) * 100, 200) : 0
  const isOver = total > target
  const overBy = isOver ? +(total - target).toFixed(3) : 0

  // Expected consumption based on week elapsed
  const expectedPct = weekProgress.elapsedPct
  const actualPct = target > 0 ? (total / target) * 100 : 0
  const isAheadOfPace = actualPct > expectedPct

  const barColor = isOver
    ? 'bg-red-500'
    : isAheadOfPace
    ? 'bg-amber-500'
    : 'bg-emerald-500'

  const barPct = Math.min((total / target) * 100, 100)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">Weekly Target</h2>
        {isOver && (
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-full flex items-center gap-1">
            ⚠️ Over target
          </span>
        )}
      </div>

      {/* Week elapsed label (DP3) */}
      <p className="text-xs text-gray-400 mb-4" data-testid="week-progress-label">
        {formatWeekProgressLabel(weekProgress)}
      </p>

      {/* Progress bar */}
      <div className="relative mb-3">
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
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
            className="absolute top-0 h-4 w-0.5 bg-gray-400 opacity-50"
            style={{ left: `${expectedPct}%` }}
            title={`Expected usage at this point in the week (${expectedPct}%)`}
          />
        )}
      </div>

      {/* Numbers */}
      <div className="flex items-baseline justify-between">
        <div>
          {isOver ? (
            <p className="text-base font-bold text-red-600" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target — over by {overBy.toFixed(1)} kg
            </p>
          ) : (
            <p className="text-base font-semibold text-gray-700" data-testid="target-status">
              {total.toFixed(1)} kg / {target} kg target
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {isAheadOfPace && !isOver
              ? `⚡ Ahead of pace — ${(actualPct - expectedPct).toFixed(0)}% over expected at this point in the week`
              : !isOver
              ? `✅ On track — ${(expectedPct - actualPct).toFixed(0)}% below expected pace`
              : ''}
          </p>
        </div>
        <span className={`text-2xl font-bold ${isOver ? 'text-red-600' : isAheadOfPace ? 'text-amber-600' : 'text-emerald-600'}`}>
          {Math.round(barPct)}%
        </span>
      </div>
    </div>
  )
}
