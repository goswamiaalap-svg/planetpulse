/**
 * lib/rag/validation/outputValidator.ts
 * Rigorous output validation layer verifying factual grounding, user data consistency,
 * data completeness compliance, and tone policy.
 */

import { EMISSION_FACTORS } from '@/lib/co2'
import { UserContext } from '../context/userContext'
import { OutputValidationResult, DomainDecision } from '../types'

export function validateCoachOutput(
  answer: string,
  domainDecision: DomainDecision,
  userContext: UserContext,
  retrievedText: string,
  isRefusalOrAbstention: boolean,
  recommendations: string[] = []
): OutputValidationResult {
  const violations: string[] = []
  let checkedFactsCount = 0
  let unsupportedClaimsCount = 0
  let sanitizedAnswer = answer
  const sanitizedRecommendations: string[] = [...recommendations]

  // 1. If it was an out-of-domain or abstention query, ensure it actually refused
  if (!domainDecision.isAllowed || isRefusalOrAbstention) {
    const refusalSignatures = [
      'i can help with carbon emissions',
      'i don\'t have enough',
      'i cannot follow instructions',
      'planetpulse knowledge base',
      'sustainability',
      'verified information',
    ]
    const lower = answer.toLowerCase()
    const matchesRefusal = refusalSignatures.some((sig) => lower.includes(sig))

    if (!matchesRefusal && !domainDecision.isAllowed) {
      violations.push('Model attempted to answer an out-of-domain query instead of adhering to the domain refusal.')
      unsupportedClaimsCount++
    }

    return {
      isValid: violations.length === 0,
      violations,
      checkedFactsCount: 1,
      unsupportedClaimsCount,
      sanitizedAnswer: violations.length === 0 ? answer : domainDecision.refusalReason || 'I can only assist with carbon footprint and climate questions.',
      sanitizedRecommendations: [
        'Ask about reducing transportation or driving emissions.',
        'Ask how to reduce electricity and household power usage.',
        'Explore carbon footprint comparisons for diet and meal choices.',
      ],
    }
  }

  // 2. Check for shaming / guilt-tripping language
  const shamingPatterns = [
    /you\s+should\s+be\s+ashamed/i,
    /how\s+dare\s+you/i,
    /terrible\s+job/i,
    /you\s+failed\s+miserably/i,
    /guilty\s+for/i,
  ]

  for (const pattern of shamingPatterns) {
    if (pattern.test(answer)) {
      violations.push('Violates tone policy: contains shaming or judgmental language.')
    }
  }

  // 3. Check for contradicted emission factors
  // e.g. Car is 0.20, Bus is 0.08, Flight is 0.25, Electricity is 0.80, Veg is 0.5, Non-veg is 2.0
  const carFactorMatch = answer.match(/\bcar(?: travel| driving)?\s+(?:emits|produces|factor\s+(?:is|of))\s*(\d+(?:\.\d+)?)\s*kg\s*co2(?:\/km|\s*per\s*km)/i)
  if (carFactorMatch) {
    checkedFactsCount++
    const statedFactor = parseFloat(carFactorMatch[1])
    if (Math.abs(statedFactor - EMISSION_FACTORS.car) > 0.05 && Math.abs(statedFactor - EMISSION_FACTORS.car * 100) > 1) {
      violations.push(`Hallucinated emission factor: Car travel stated as ${statedFactor} kg CO2/km (standard is ${EMISSION_FACTORS.car}).`)
      unsupportedClaimsCount++
    }
  }

  // 4. Missing / Zero Data Validation:
  // If user data is empty or zero-measured, reject claims attributing a primary emitting sector to the user!
  const lowerAnswer = answer.toLowerCase()
  if (userContext.dataStatus === 'empty' || userContext.dataStatus === 'db_error') {
    const claimsUserHasPrimarySector =
      /\b(your|in your (?:current )?footprint)[^.]*?\b(primary|largest|biggest|main|highest)\s+(?:source|sector|contributor|driver|emitter)\b/i.test(answer) ||
      /\byour (?:primary|largest|biggest|main|highest) (?:source|sector|contributor|driver|emitter) is\b/i.test(answer)

    if (claimsUserHasPrimarySector) {
      violations.push('Falsely identified a primary emitting sector for the user when no activities are recorded for this period.')
      unsupportedClaimsCount++
      sanitizedAnswer = `No activity records have been logged in your carbon ledger for the current reporting period (${userContext.reportingPeriod.from || 'this week'}). Because your footprint is currently unrecorded, a primary emission sector cannot be determined. To calculate your footprint and receive tailored guidance, please log your recent activities such as commuting, electricity use, or meals.`
    }
  }

  // 5. Unsupported Personal Transportation Recommendations:
  // If user has NO car activity logged AND query does not mention cars/driving,
  // do NOT recommend buying an EV, carpooling, or changing driving habits as a personal recommendation!
  const hasCarActivity = userContext.sectors?.car?.logged && userContext.sectors.car.quantityTotal > 0
  const queryMentionsCar = /\b(car|drive|driving|vehicle|commute|auto)\b/i.test(domainDecision.normalizedQuery)

  if (!hasCarActivity && !queryMentionsCar) {
    // Check if recommendations make unsolicited personal car/EV demands
    for (let i = 0; i < sanitizedRecommendations.length; i++) {
      const rec = sanitizedRecommendations[i]
      if (/\b(electric vehicle|ev\b|carpool|driving habits|short trips currently taken by car)\b/i.test(rec)) {
        violations.push(`Unsupported recommendation: Suggesting vehicle/EV changes (${rec}) without user car activity or query relevance.`)
        unsupportedClaimsCount++
        // Replace with an evidence-based recommendation suited to user context
        if (userContext.sectors?.electricity?.logged) {
          sanitizedRecommendations[i] = 'Optimize household electricity by auditing standby power on idle electronics.'
        } else if (userContext.sectors?.veg_meal?.logged || userContext.sectors?.non_veg_meal?.logged) {
          sanitizedRecommendations[i] = 'Explore plant-forward meal choices to lower dietary carbon intensity.'
        } else {
          sanitizedRecommendations[i] = 'Log your regular daily activities (transit, electricity, or meals) to identify personal reduction opportunities.'
        }
      }
    }
  }

  // 6. Check that numerical user stats referenced in answer align with userContext
  // Match claims like "you have logged 45 kg" or "weekly total is 45 kg"
  const userTotalClaimRegex = /\b(?:logged|total(?: is| of)?|emitted)\s+(\d+(?:\.\d+)?)\s*kg\s*(?:of\s*)?co2\b/gi
  let match: RegExpExecArray | null
  while ((match = userTotalClaimRegex.exec(answer)) !== null) {
    checkedFactsCount++
    const claimedNumber = parseFloat(match[1])
    // Allow small rounding differences (e.g. 15.2 vs 15.25)
    if (Math.abs(claimedNumber - userContext.weeklyTotalCO2) > 1.0) {
      violations.push(`Numerical mismatch: Answer stated ${claimedNumber} kg CO2 as user total, but ledger shows ${userContext.weeklyTotalCO2} kg CO2.`)
      unsupportedClaimsCount++
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    checkedFactsCount,
    unsupportedClaimsCount,
    sanitizedAnswer,
    sanitizedRecommendations,
  }
}
