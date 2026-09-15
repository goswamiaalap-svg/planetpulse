import { Activity } from '@/lib/supabase'
import { ActivityType, getTypeName } from '@/lib/co2'

export interface UserContext {
  weeklyTotalCO2: number
  previousWeekTotalCO2: number
  weeklyDeltaCO2: number
  weeklyPercentChange: number
  isIncrease: boolean
  weeklyTarget: number | null
  targetExceededBy: number
  percentTargetUsed: number
  isOverTarget: boolean
  largestCategory: string
  largestCategoryCO2: number
  largestCategoryPercent: number
  breakdownSummary: string
  recentActivitiesCount: number
  activitiesSummary: string
}

/**
 * Builds non-sensitive, grounded user carbon context from activities and settings
 */
export function buildUserContext(
  activities: Activity[],
  weeklyTarget: number | null,
  previousWeekActivities: Activity[] = []
): UserContext {
  const total = activities.reduce((sum, a) => sum + Number(a.co2_kg), 0)
  const prevTotal = previousWeekActivities.reduce((sum, a) => sum + Number(a.co2_kg), 0)
  const delta = +(total - prevTotal).toFixed(2)
  const percentChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0
  const isIncrease = total > prevTotal

  const target = weeklyTarget ?? null

  const breakdownMap: Partial<Record<ActivityType, number>> = {}
  for (const a of activities) {
    breakdownMap[a.type] = (breakdownMap[a.type] ?? 0) + Number(a.co2_kg)
  }

  const sortedBreakdown = Object.entries(breakdownMap)
    .map(([type, co2]) => ({
      type: type as ActivityType,
      name: getTypeName(type as ActivityType),
      co2: Number(co2),
    }))
    .sort((a, b) => b.co2 - a.co2)

  const topCategory = sortedBreakdown[0] || { name: 'None', co2: 0 }
  const topCategoryPercent = total > 0 ? Math.round((topCategory.co2 / total) * 100) : 0

  const breakdownSummary = sortedBreakdown
    .map((c) => `${c.name}: ${c.co2.toFixed(1)} kg CO₂ (${total > 0 ? Math.round((c.co2 / total) * 100) : 0}%)`)
    .join(', ')

  const isOver = target !== null && total > target
  const exceededBy = isOver && target ? +(total - target).toFixed(1) : 0
  const percentUsed = target && target > 0 ? Math.round((total / target) * 100) : 0

  const activitiesSummary = activities
    .slice(0, 5)
    .map((a) => `${getTypeName(a.type)}: ${a.quantity} on ${a.date} (${Number(a.co2_kg).toFixed(1)} kg)`)
    .join('; ')

  return {
    weeklyTotalCO2: +total.toFixed(2),
    previousWeekTotalCO2: +prevTotal.toFixed(2),
    weeklyDeltaCO2: delta,
    weeklyPercentChange: percentChange,
    isIncrease,
    weeklyTarget: target,
    targetExceededBy: exceededBy,
    percentTargetUsed: percentUsed,
    isOverTarget: isOver,
    largestCategory: topCategory.name,
    largestCategoryCO2: +topCategory.co2.toFixed(2),
    largestCategoryPercent: topCategoryPercent,
    breakdownSummary,
    recentActivitiesCount: activities.length,
    activitiesSummary,
  }
}
