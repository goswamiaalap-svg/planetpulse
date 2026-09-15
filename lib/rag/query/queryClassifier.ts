export type QueryIntent =
  | 'footprint_explanation'
  | 'reduction_advice'
  | 'transportation'
  | 'food'
  | 'energy'
  | 'weekly_goal'
  | 'what_if'
  | 'general_carbon_question'

export interface ClassifiedQuery {
  intent: QueryIntent
  requiresRAG: boolean
  targetTopic?: string
  targetSubtopic?: string
}

/**
 * Lightweight deterministic intent classifier without LLM overhead
 */
export function classifyQuery(question: string): ClassifiedQuery {
  const q = question.toLowerCase()

  // What-if simulator
  if (q.includes('what if') || q.includes('what happens if') || q.includes('simulate') || q.includes('replace')) {
    return { intent: 'what_if', requiresRAG: true }
  }

  // Pure database question (no RAG needed)
  if (
    (q.includes('what did i emit') || q.includes('total this week') || q.includes('how much co2')) &&
    !q.includes('reduce') &&
    !q.includes('lower') &&
    !q.includes('cut')
  ) {
    return { intent: 'footprint_explanation', requiresRAG: false }
  }

  // Transportation specific
  if (q.includes('car') || q.includes('drive') || q.includes('driving')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'car' }
  }
  if (q.includes('bus') || q.includes('transit') || q.includes('train')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'bus' }
  }
  if (q.includes('flight') || q.includes('fly') || q.includes('plane')) {
    return { intent: 'transportation', requiresRAG: true, targetTopic: 'transportation', targetSubtopic: 'flights' }
  }

  // Food / Diet
  if (q.includes('food') || q.includes('diet') || q.includes('meat') || q.includes('vegan') || q.includes('vegetarian') || q.includes('meal')) {
    return { intent: 'food', requiresRAG: true, targetTopic: 'food' }
  }

  // Energy / Electricity
  if (q.includes('electricity') || q.includes('power') || q.includes('energy') || q.includes('heating') || q.includes('appliance')) {
    return { intent: 'energy', requiresRAG: true, targetTopic: 'energy' }
  }

  // Target / Goals
  if (q.includes('target') || q.includes('goal') || q.includes('exceeded') || q.includes('budget')) {
    return { intent: 'weekly_goal', requiresRAG: true }
  }

  // General reduction advice
  if (q.includes('reduce') || q.includes('lower') || q.includes('cut') || q.includes('help') || q.includes('advice') || q.includes('tips')) {
    return { intent: 'reduction_advice', requiresRAG: true }
  }

  return { intent: 'general_carbon_question', requiresRAG: true }
}

/**
 * Rewrites user question into high-relevance retrieval query based on context & intent
 */
export function rewriteQueryForRetrieval(
  question: string,
  intent: ClassifiedQuery,
  largestCategory: string
): string {
  // If intent has specific subtopic
  if (intent.targetSubtopic === 'car') {
    return 'Methods to reduce personal vehicle emissions, eco-driving habits, carpooling, trip chaining, and active transit alternatives'
  }
  if (intent.targetSubtopic === 'bus') {
    return 'Climate benefits of public transit and municipal bus systems over single-occupant cars'
  }
  if (intent.targetSubtopic === 'flights') {
    return 'Aviation greenhouse gas intensity, high-altitude radiative forcing, and high-speed rail substitution'
  }
  if (intent.targetTopic === 'food') {
    return 'Carbon footprint comparison of plant-based vegetarian meals vs meat consumption and agricultural emissions'
  }
  if (intent.targetTopic === 'energy') {
    return 'Household electricity carbon reduction, HVAC thermostat optimization, vampire standby power, and efficiency'
  }

  // Generic reduction advice tailored to user's top emitting category
  if (intent.intent === 'reduction_advice' || intent.intent === 'weekly_goal') {
    return `Practical lifestyle decarbonization strategies focusing especially on ${largestCategory.toLowerCase()} reduction and emission factors`
  }

  return question
}
