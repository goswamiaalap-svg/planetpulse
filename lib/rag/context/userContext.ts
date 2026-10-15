import { Activity } from '@/lib/supabase'
import { ActivityType, getTypeName, getUnitLabel, EMISSION_FACTORS } from '@/lib/co2'

export type DataCompletenessStatus =
  | 'complete'       // 3 or more standard sectors logged with non-zero or measured values
  | 'partial'        // 1 or 2 sectors logged, other sectors unrecorded
  | 'empty'          // No activity entries logged for the reporting period
  | 'zero_measured'  // User explicitly logged activities, but all have 0 kg CO2
  | 'db_error'       // Database ledger query failed or returned an error

export interface SectorDetail {
  type: ActivityType
  name: string
  unit: string
  logged: boolean
  count: number
  quantityTotal: number
  co2_kg: number
  percentOfTotal: number
}

export interface UserContext {
  // Overall aggregates
  weeklyTotalCO2: number
  previousWeekTotalCO2: number
  weeklyDeltaCO2: number
  weeklyPercentChange: number
  isIncrease: boolean

  // Target metrics
  weeklyTarget: number | null
  targetExceededBy: number
  percentTargetUsed: number
  isOverTarget: boolean

  // Primary sector metrics (strictly null if no data or 0 total)
  largestCategory: string | null
  largestCategoryCO2: number
  largestCategoryPercent: number

  // Breakdown & Ledger Summaries
  breakdownSummary: string
  recentActivitiesCount: number
  activitiesSummary: string

  // Grounded Data Quality & Completeness Metadata
  dataStatus: DataCompletenessStatus
  dbErrorMessage?: string
  hasValidFootprint: boolean
  isZeroFootprint: boolean
  reportingPeriod: {
    from: string
    to: string
  }
  sectors: Record<ActivityType, SectorDetail>
  sectorsWithData: string[]
  sectorsMissing: string[]
  dataCompletenessDescription: string
}

export interface BuildUserContextOptions {
  previousWeekActivities?: Activity[]
  dbError?: string | null
  reportingPeriod?: {
    from: string
    to: string
  }
}

const ALL_ACTIVITY_TYPES: ActivityType[] = [
  'car',
  'bus',
  'flight',
  'electricity',
  'veg_meal',
  'non_veg_meal',
]

/**
 * Builds non-sensitive, grounded user carbon context from activities and settings
 */
export function buildUserContext(
  activities: Activity[] | null | undefined,
  weeklyTarget: number | null,
  previousWeekActivitiesOrOptions?: Activity[] | BuildUserContextOptions
): UserContext {
  let prevActivities: Activity[] = []
  let dbError: string | null = null
  let reportingPeriod = { from: '', to: '' }

  if (Array.isArray(previousWeekActivitiesOrOptions)) {
    prevActivities = previousWeekActivitiesOrOptions
  } else if (previousWeekActivitiesOrOptions && typeof previousWeekActivitiesOrOptions === 'object') {
    prevActivities = previousWeekActivitiesOrOptions.previousWeekActivities || []
    dbError = previousWeekActivitiesOrOptions.dbError || null
    if (previousWeekActivitiesOrOptions.reportingPeriod) {
      reportingPeriod = previousWeekActivitiesOrOptions.reportingPeriod
    }
  }

  // Handle null / undefined activities array defensively
  const safeActivities: Activity[] = Array.isArray(activities) ? activities : []
  const safePrevActivities: Activity[] = Array.isArray(prevActivities) ? prevActivities : []

  // Clean numerical validation to prevent NaN propagation
  const total = safeActivities.reduce((sum, a) => {
    const val = Number(a.co2_kg)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const prevTotal = safePrevActivities.reduce((sum, a) => {
    const val = Number(a.co2_kg)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const delta = +(total - prevTotal).toFixed(2)
  const percentChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0
  const isIncrease = total > prevTotal

  const target = weeklyTarget ?? null

  // Build sector-level tracking for all 6 standard sectors
  const sectorMap: Record<ActivityType, SectorDetail> = {
    car: { type: 'car', name: getTypeName('car'), unit: getUnitLabel('car'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
    bus: { type: 'bus', name: getTypeName('bus'), unit: getUnitLabel('bus'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
    flight: { type: 'flight', name: getTypeName('flight'), unit: getUnitLabel('flight'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
    electricity: { type: 'electricity', name: getTypeName('electricity'), unit: getUnitLabel('electricity'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
    veg_meal: { type: 'veg_meal', name: getTypeName('veg_meal'), unit: getUnitLabel('veg_meal'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
    non_veg_meal: { type: 'non_veg_meal', name: getTypeName('non_veg_meal'), unit: getUnitLabel('non_veg_meal'), logged: false, count: 0, quantityTotal: 0, co2_kg: 0, percentOfTotal: 0 },
  }

  for (const a of safeActivities) {
    if (a && a.type && sectorMap[a.type]) {
      const co2 = Number(a.co2_kg) || 0
      const qty = Number(a.quantity) || 0
      sectorMap[a.type].logged = true
      sectorMap[a.type].count += 1
      sectorMap[a.type].quantityTotal += qty
      sectorMap[a.type].co2_kg += co2
    }
  }

  // Calculate percentages
  for (const t of ALL_ACTIVITY_TYPES) {
    sectorMap[t].co2_kg = +sectorMap[t].co2_kg.toFixed(2)
    sectorMap[t].quantityTotal = +sectorMap[t].quantityTotal.toFixed(2)
    sectorMap[t].percentOfTotal = total > 0 ? Math.round((sectorMap[t].co2_kg / total) * 100) : 0
  }

  const sectorsWithData: string[] = []
  const sectorsMissing: string[] = []

  for (const t of ALL_ACTIVITY_TYPES) {
    if (sectorMap[t].logged) {
      sectorsWithData.push(sectorMap[t].name)
    } else {
      sectorsMissing.push(sectorMap[t].name)
    }
  }

  // Determine sorted breakdown among logged sectors with CO2
  const loggedBreakdown = Object.values(sectorMap)
    .filter((s) => s.logged)
    .sort((a, b) => b.co2_kg - a.co2_kg)

  // Determine largest category strictly when data supports it
  let largestCategory: string | null = null
  let largestCategoryCO2 = 0
  let largestCategoryPercent = 0

  if (total > 0 && loggedBreakdown.length > 0 && loggedBreakdown[0].co2_kg > 0) {
    largestCategory = loggedBreakdown[0].name
    largestCategoryCO2 = loggedBreakdown[0].co2_kg
    largestCategoryPercent = loggedBreakdown[0].percentOfTotal
  }

  // Determine data completeness status
  let dataStatus: DataCompletenessStatus = 'empty'
  let dataCompletenessDescription = ''

  if (dbError) {
    dataStatus = 'db_error'
    dataCompletenessDescription = `Database query failed: ${dbError}. Footprint ledger is temporarily unavailable.`
  } else if (safeActivities.length === 0) {
    dataStatus = 'empty'
    dataCompletenessDescription = 'No activities recorded for the current reporting period. Footprint is uncalculated.'
  } else if (total === 0) {
    dataStatus = 'zero_measured'
    dataCompletenessDescription = `Measured footprint is 0.0 kg CO₂ across ${safeActivities.length} recorded events with zero net emissions.`
  } else if (sectorsWithData.length >= 3) {
    dataStatus = 'complete'
    dataCompletenessDescription = `Comprehensive footprint tracked across ${sectorsWithData.length} sectors (${sectorsWithData.join(', ')}).`
  } else {
    dataStatus = 'partial'
    dataCompletenessDescription = `Partial footprint: only ${sectorsWithData.join(', ')} logged. Missing data for: ${sectorsMissing.join(', ')}.`
  }

  const breakdownSummary = loggedBreakdown.length > 0
    ? loggedBreakdown
        .map((c) => `${c.name}: ${c.co2_kg.toFixed(1)} kg CO₂ (${total > 0 ? Math.round((c.co2_kg / total) * 100) : 0}%)`)
        .join(', ')
    : 'No sector emissions recorded'

  const isOver = target !== null && total > target
  const exceededBy = isOver && target ? +(total - target).toFixed(1) : 0
  const percentUsed = target && target > 0 ? Math.round((total / target) * 100) : 0

  const activitiesSummary = safeActivities
    .slice(0, 5)
    .map((a) => `${getTypeName(a.type)}: ${a.quantity} ${getUnitLabel(a.type)} on ${a.date} (${Number(a.co2_kg).toFixed(1)} kg CO₂)`)
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
    largestCategory,
    largestCategoryCO2,
    largestCategoryPercent,
    breakdownSummary,
    recentActivitiesCount: safeActivities.length,
    activitiesSummary,
    dataStatus,
    dbErrorMessage: dbError || undefined,
    hasValidFootprint: total > 0 && safeActivities.length > 0,
    isZeroFootprint: safeActivities.length > 0 && total === 0,
    reportingPeriod,
    sectors: sectorMap,
    sectorsWithData,
    sectorsMissing,
    dataCompletenessDescription,
  }
}
