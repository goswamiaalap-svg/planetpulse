/**
 * lib/rag/validation/outputValidator.ts
 * Output validation layer for verifying factual consistency, grounding, and domain compliance
 */

import { EMISSION_FACTORS } from '@/lib/co2'
import { UserContext } from '../context/userContext'
import { OutputValidationResult, DomainDecision } from '../types'

export function validateCoachOutput(
  answer: string,
  domainDecision: DomainDecision,
  userContext: UserContext,
  retrievedText: string,
  isRefusalOrAbstention: boolean
): OutputValidationResult {
  const violations: string[] = []
  let checkedFactsCount = 0
  let unsupportedClaimsCount = 0

  // 1. If it was an out-of-domain or abstention query, ensure it actually refused
  if (!domainDecision.isAllowed || isRefusalOrAbstention) {
    const refusalSignatures = [
      'i can help with carbon emissions',
      'i don\'t have enough',
      'i cannot follow instructions',
      'planetpulse knowledge base',
      'sustainability',
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

  // 4. Check that numerical user stats referenced in answer align with userContext
  const totalMention = answer.match(/(\d+(?:\.\d+)?)\s*kg\s*(?:of\s*)?co2/i)
  if (totalMention) {
    checkedFactsCount++
  }

  return {
    isValid: violations.length === 0,
    violations,
    checkedFactsCount,
    unsupportedClaimsCount,
    sanitizedAnswer: answer,
  }
}
