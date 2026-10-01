/**
 * lib/rag/query/queryClassifier.ts
 * Query classification and contextual query rewriting with domain gating
 */

import { evaluateDomainGate, normalizeQuery } from '../guardrails/domainGate'
import { DomainDecision } from '../types'

export type QueryIntent =
  | 'footprint_explanation'
  | 'reduction_advice'
  | 'transportation'
  | 'food'
  | 'energy'
  | 'weekly_goal'
  | 'what_if'
  | 'general_carbon_question'
  | 'out_of_domain'
  | 'adversarial_injection'

export interface ClassifiedQuery {
  intent: QueryIntent
  requiresRAG: boolean
  domainDecision: DomainDecision
  targetTopic?: string
  targetSubtopic?: string
}

/**
 * Deterministic intent classifier with integrated domain guardrails
 */
export function classifyQuery(rawQuestion: string): ClassifiedQuery {
  const domainDecision = evaluateDomainGate(rawQuestion)

  if (!domainDecision.isAllowed) {
    return {
      intent: domainDecision.category === 'adversarial_injection' ? 'adversarial_injection' : 'out_of_domain',
      requiresRAG: false,
      domainDecision,
    }
  }

  const q = domainDecision.normalizedQuery.toLowerCase()

  // What-if simulator
  if (q.includes('what if') || q.includes('what happens if') || q.includes('simulate') || q.includes('replace') || q.includes('swap')) {
    return { intent: 'what_if', requiresRAG: true, domainDecision }
  }

  // Pure database user statistics (no RAG search required)
  if (
    (q.includes('what did i emit') ||
      q.includes('my footprint') ||
      q.includes('my emissions') ||
      q.includes('total this week') ||
      q.includes('my total co2') ||
      q.includes('how much co2 did i') ||
      q.includes('my carbon summary')) &&
    !q.includes('reduce') &&
    !q.includes('lower') &&
    !q.includes('cut') &&
    !q.includes('how to') &&
    !q.includes('advice')
  ) {
    return { intent: 'footprint_explanation', requiresRAG: false, domainDecision }
  }

  // Transportation specific
  if (q.includes('car') || q.includes('drive') || q.includes('driving') || q.includes('vehicle')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'car', domainDecision }
  }
  if (q.includes('bus') || q.includes('transit') || q.includes('train') || q.includes('public transport')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'bus', domainDecision }
  }
  if (q.includes('flight') || q.includes('fly') || q.includes('plane') || q.includes('aviation')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'flights', domainDecision }
  }

  // Food / Diet
  if (q.includes('food') || q.includes('diet') || q.includes('meat') || q.includes('vegan') || q.includes('vegetarian') || q.includes('meal') || q.includes('beef')) {
    return { intent: 'food', requiresRAG: true, targetTopic: 'food', domainDecision }
  }

  // Energy / Electricity
  if (q.includes('electricity') || q.includes('power') || q.includes('energy') || q.includes('heating') || q.includes('appliance') || q.includes('kwh')) {
    return { intent: 'energy', requiresRAG: true, targetTopic: 'energy', targetSubtopic: 'electricity', domainDecision }
  }

  // Target / Goals
  if (q.includes('target') || q.includes('goal') || q.includes('exceeded') || q.includes('budget')) {
    return { intent: 'weekly_goal', requiresRAG: true, domainDecision }
  }

  // General reduction advice
  if (q.includes('reduce') || q.includes('lower') || q.includes('cut') || q.includes('help') || q.includes('advice') || q.includes('tips')) {
    return { intent: 'reduction_advice', requiresRAG: true, domainDecision }
  }

  return { intent: 'general_carbon_question', requiresRAG: true, domainDecision }
}

/**
 * Rewrites user question into high-relevance retrieval query based on context & intent
 * Note: Only executed for verified in-domain queries!
 */
export function rewriteQueryForRetrieval(
  question: string,
  classification: ClassifiedQuery,
  largestCategory: string
): string {
  // If out of domain, do NOT rewrite to a carbon topic!
  if (!classification.domainDecision.isAllowed) {
    return classification.domainDecision.normalizedQuery
  }

  // If intent has specific subtopic
  if (classification.targetSubtopic === 'car') {
    return 'Methods to reduce personal vehicle emissions, eco-driving habits, carpooling, trip chaining, and active transit alternatives'
  }
  if (classification.targetSubtopic === 'bus') {
    return 'Climate benefits of public transit and municipal bus systems over single-occupant cars'
  }
  if (classification.targetSubtopic === 'flights') {
    return 'Aviation greenhouse gas intensity, high-altitude radiative forcing, and high-speed rail substitution'
  }
  if (classification.targetTopic === 'food') {
    return 'Carbon footprint comparison of plant-based vegetarian meals vs meat consumption and agricultural emissions'
  }
  if (classification.targetTopic === 'energy') {
    return 'Household electricity carbon reduction, HVAC thermostat optimization, vampire standby power, and efficiency'
  }

  // Generic reduction advice tailored to user's top emitting category
  if (classification.intent === 'reduction_advice' || classification.intent === 'weekly_goal') {
    return `Practical lifestyle decarbonization strategies focusing especially on ${largestCategory.toLowerCase()} reduction and emission factors`
  }

  return classification.domainDecision.normalizedQuery
}
