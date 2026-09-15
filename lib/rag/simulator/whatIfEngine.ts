import { ActivityType, calculateCO2, getTypeName, getUnitLabel } from '@/lib/co2'

export interface WhatIfScenario {
  fromType: ActivityType
  toType?: ActivityType
  quantity: number
  description?: string
}

export interface WhatIfResult {
  scenario: string
  originalCO2: number
  newCO2: number
  savedCO2: number
  percentageSaved: number
  explanation: string
}

/**
 * Deterministic calculation engine for what-if scenarios (No LLM arithmetic)
 */
export function calculateWhatIf(scenario: WhatIfScenario): WhatIfResult {
  const originalCO2 = calculateCO2(scenario.fromType, scenario.quantity)
  const newCO2 = scenario.toType ? calculateCO2(scenario.toType, scenario.quantity) : 0

  const savedCO2 = +(originalCO2 - newCO2).toFixed(3)
  const percentageSaved = originalCO2 > 0 ? Math.round((savedCO2 / originalCO2) * 100) : 0

  const fromName = getTypeName(scenario.fromType)
  const toName = scenario.toType ? getTypeName(scenario.toType) : 'eliminating the activity'
  const unit = getUnitLabel(scenario.fromType)

  const explanation = `Swapping ${scenario.quantity} ${unit} of ${fromName} with ${toName} reduces emissions by ${savedCO2.toFixed(2)} kg CO₂ (${percentageSaved}% reduction) under deterministic emission factor benchmarks.`

  return {
    scenario: `${scenario.quantity} ${unit} of ${fromName} → ${toName}`,
    originalCO2,
    newCO2,
    savedCO2,
    percentageSaved,
    explanation,
  }
}
