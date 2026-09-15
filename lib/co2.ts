// lib/co2.ts — Pure CO2 calculation functions
// EXACT emission factors as specified — do not modify these values

export const EMISSION_FACTORS = {
  car: 0.20,         // kg CO2 per km
  bus: 0.08,         // kg CO2 per km
  flight: 0.25,      // kg CO2 per km
  electricity: 0.80, // kg CO2 per kWh
  veg_meal: 0.5,     // kg CO2 per meal
  non_veg_meal: 2.0, // kg CO2 per meal
} as const

export type ActivityType = keyof typeof EMISSION_FACTORS

/**
 * Calculate CO2 emissions for an activity.
 * @param type - The activity type (car, bus, flight, electricity, veg_meal, non_veg_meal)
 * @param quantity - The quantity (km for travel, kWh for electricity, count for meals)
 * @returns CO2 in kg, rounded to 3 decimal places
 */
export function calculateCO2(type: ActivityType, quantity: number): number {
  return +(EMISSION_FACTORS[type] * quantity).toFixed(3)
}

/**
 * Get the unit label for a given activity type.
 */
export function getUnitLabel(type: ActivityType): string {
  switch (type) {
    case 'car':
    case 'bus':
    case 'flight':
      return 'km'
    case 'electricity':
      return 'kWh'
    case 'veg_meal':
    case 'non_veg_meal':
      return 'meals'
  }
}

/**
 * Get the display name for an activity type.
 */
export function getTypeName(type: ActivityType): string {
  switch (type) {
    case 'car': return 'Car travel'
    case 'bus': return 'Bus travel'
    case 'flight': return 'Flight'
    case 'electricity': return 'Electricity'
    case 'veg_meal': return 'Vegetarian meal'
    case 'non_veg_meal': return 'Non-veg meal'
  }
}

/**
 * Maximum "sane" quantities per activity type before showing a warning (DP2).
 */
export const ABSURD_THRESHOLDS: Record<ActivityType, number> = {
  car: 2000,
  bus: 2000,
  flight: 20000,
  electricity: 10000,
  veg_meal: 20,
  non_veg_meal: 20,
}

/**
 * Category colors — consistent across the whole app.
 */
export const CATEGORY_COLORS: Record<ActivityType, string> = {
  car: '#ef4444',
  bus: '#f97316',
  flight: '#8b5cf6',
  electricity: '#eab308',
  veg_meal: '#22c55e',
  non_veg_meal: '#f43f5e',
}
