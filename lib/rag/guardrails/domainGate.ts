/**
 * lib/rag/guardrails/domainGate.ts
 * Deterministic and semantic Domain Gate & Adversarial Filter for PlanetPulse
 */

import { DomainCategory, DomainDecision } from '../types'

// Core in-domain terminology
const IN_DOMAIN_KEYWORDS = [
  'carbon',
  'co2',
  'co2e',
  'emission',
  'emissions',
  'footprint',
  'decarboniz',
  'decarbonis',
  'climate',
  'greenhouse',
  'ghg',
  'car',
  'driving',
  'vehicle',
  'bus',
  'transit',
  'train',
  'flight',
  'flying',
  'airplane',
  'aviation',
  'electricity',
  'kwh',
  'kilowatt',
  'power',
  'energy',
  'solar',
  'heating',
  'thermostat',
  'appliance',
  'meal',
  'vegetarian',
  'vegan',
  'meat',
  'diet',
  'beef',
  'poultry',
  'plant-based',
  'target',
  'budget',
  'weekly target',
  'planetpulse',
  'sustainable',
  'sustainability',
  'offset',
  'scope 1',
  'scope 2',
  'scope 3',
  'epa',
  'actnow',
  'defra',
  'what if',
  'simulate',
  'my emissions',
  'my footprint',
  'logged',
  'history',
]

// Explicit out-of-domain indicator terms (general trivia, coding, finance, medicine, politics, etc.)
const OUT_OF_DOMAIN_PATTERNS = [
  /\b(capital of|president of|prime minister of|queen of|king of)\b/i,
  /\b(quantum mechanics|quantum computing|black hole|general relativity|astrophysics)\b/i,
  /\b(python|javascript|typescript|react|html|css|java|c\+\+|rust|golang|code|function|class|algorithm|regex)\b/i,
  /\b(elon musk|jeff bezos|bill gates|donald trump|joe biden|taylor swift|celebrity|movie|actor)\b/i,
  /\b(tell me a joke|tell a joke|funny joke|riddle|sing a song|write a poem|write an essay|write a story)\b/i,
  /\b(weather today|weather forecast|temperature outside|is it raining|tomorrow's weather)\b/i,
  /\b(stock market|crypto|bitcoin|ethereum|forex|investing advice|buy stocks|trading)\b/i,
  /\b(diagnose|symptom|prescription|headache|disease|medical treatment|cure)\b/i,
  /\b(lawsuit|legal advice|court case|attorney|lawyer)\b/i,
  /\b(world war|french revolution|ancient rome|history of egypt|medieval)\b/i,
  /\b(machine learning|deep learning|neural network|backpropagation|gradient descent|transformer model|llm)\b/i,
  /\b(recipe for|how to bake|how to cook pizza|pasta sauce|cocktail)\b/i,
  /\b(\d+\s*[\+\-\*\/]\s*\d+|\bsolve\s+\d+|calculate\s+\d+\s*[\+\-\*\/])/i,
]

// Jailbreak & prompt injection detection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
  /forget\s+(all\s+)?(planetpulse|instructions|rules|guidelines)/i,
  /you\s+are\s+now\s+(unrestricted|dan|jailbroken|an\s+ai\s+without\s+rules)/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?instructions/i,
  /bypass\s+(safety|rules|guardrails)/i,
  /pretend\s+you\s+can\s+answer\s+anything/i,
  /do\s+not\s+mention\s+that\s+you\s+don't\s+know/i,
  /always\s+provide\s+an\s+answer/i,
  /system\s+instructions\s+are\s+wrong/i,
  /use\s+your\s+own\s+knowledge\s+instead/i,
]

// Adversarial context prefixes like "According to PlanetPulse, what is the capital of France?"
const ADVERSARIAL_PREFIXES = [
  /^according\s+to\s+planetpulse\s*,?\s*/i,
  /^as\s+a\s+carbon\s+expert\s*,?\s*/i,
  /^in\s+the\s+context\s+of\s+planetpulse\s*,?\s*/i,
  /^for\s+my\s+carbon\s+footprint\s*,?\s*tell\s+me\s+/i,
  /^planetpulse\s*:\s*/i,
]

export const STANDARD_DOMAIN_REFUSAL =
  "I can help with carbon emissions, CO₂ footprints, PlanetPulse data, and related sustainability questions."

export const INSUFFICIENT_CONTEXT_REFUSAL =
  "I don't have enough verified information in the PlanetPulse knowledge base to answer that reliably."

export const ADVERSARIAL_REFUSAL =
  "I cannot follow instructions to override system safety or domain boundaries. I can only assist with carbon emissions and sustainability tracking."

/**
 * Normalizes user input: strips adversarial prefixes, cleans whitespace, lowercases
 */
export function normalizeQuery(rawQuery: string): { normalized: string; strippedPrefix?: string } {
  let cleaned = rawQuery.trim().replace(/\s+/g, ' ')
  let strippedPrefix: string | undefined

  for (const prefix of ADVERSARIAL_PREFIXES) {
    if (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, '').trim()
      strippedPrefix = prefix.source
      break
    }
  }

  return { normalized: cleaned, strippedPrefix }
}

/**
 * Evaluates whether a query is strictly within PlanetPulse's supported domain
 */
export function evaluateDomainGate(rawQuery: string): DomainDecision {
  const query = rawQuery.trim()
  if (!query) {
    return {
      isAllowed: false,
      category: 'out_of_domain',
      confidence: 1.0,
      refusalReason: STANDARD_DOMAIN_REFUSAL,
      normalizedQuery: '',
    }
  }

  // 1. Check for prompt injection / jailbreak attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      return {
        isAllowed: false,
        category: 'adversarial_injection',
        confidence: 0.99,
        refusalReason: ADVERSARIAL_REFUSAL,
        normalizedQuery: query,
        isAdversarial: true,
      }
    }
  }

  // 2. Normalize and strip trick prefixes (e.g. "According to PlanetPulse...")
  const { normalized } = normalizeQuery(query)
  const lower = normalized.toLowerCase()

  // 3. Check for explicit out-of-domain patterns on the stripped core query
  for (const pattern of OUT_OF_DOMAIN_PATTERNS) {
    if (pattern.test(lower)) {
      // Check if there is an explicit carbon override (e.g. "python code to calculate co2" is still out of domain since we aren't a coding bot)
      return {
        isAllowed: false,
        category: 'out_of_domain',
        confidence: 0.95,
        refusalReason: STANDARD_DOMAIN_REFUSAL,
        normalizedQuery: normalized,
      }
    }
  }

  // 4. In-domain keyword & intent scoring
  let matchCount = 0
  for (const kw of IN_DOMAIN_KEYWORDS) {
    if (lower.includes(kw)) {
      matchCount++
    }
  }

  // Activity type mentions
  const hasMobility = /\b(car|driving|bus|flight|fly|train|transit|walk|bike|commute)\b/i.test(lower)
  const hasEnergy = /\b(electricity|kwh|energy|power|solar|heating|cooling|thermostat)\b/i.test(lower)
  const hasDiet = /\b(food|meal|vegetarian|vegan|meat|beef|chicken|diet|eating)\b/i.test(lower)
  const hasCarbon = /\b(carbon|co2|emission|footprint|reduction|target|budget|reduce|cut|offset)\b/i.test(lower)
  const hasStats = /\b(my\s+emissions|what\s+did\s+i|total\s+this\s+week|how\s+much\s+co2|my\s+data|history)\b/i.test(lower)
  const hasWhatIf = /\b(what\s+if|simulate|swap|replace)\b/i.test(lower)

  if (hasWhatIf) {
    return {
      isAllowed: true,
      category: 'what_if_simulation',
      confidence: 0.95,
      normalizedQuery: normalized,
    }
  }

  if (hasStats && !lower.includes('reduce') && !lower.includes('cut')) {
    return {
      isAllowed: true,
      category: 'user_history_stats',
      confidence: 0.95,
      normalizedQuery: normalized,
    }
  }

  if (hasMobility) {
    return {
      isAllowed: true,
      category: 'transportation',
      confidence: matchCount > 1 ? 0.95 : 0.85,
      normalizedQuery: normalized,
    }
  }

  if (hasEnergy) {
    return {
      isAllowed: true,
      category: 'energy_utilities',
      confidence: matchCount > 1 ? 0.95 : 0.85,
      normalizedQuery: normalized,
    }
  }

  if (hasDiet) {
    return {
      isAllowed: true,
      category: 'diet_food',
      confidence: matchCount > 1 ? 0.95 : 0.85,
      normalizedQuery: normalized,
    }
  }

  if (hasCarbon || matchCount >= 1) {
    return {
      isAllowed: true,
      category: 'carbon_tracking',
      confidence: 0.85,
      normalizedQuery: normalized,
    }
  }

  // 5. Query did not match any in-domain criteria
  return {
    isAllowed: false,
    category: 'out_of_domain',
    confidence: 0.9,
    refusalReason: STANDARD_DOMAIN_REFUSAL,
    normalizedQuery: normalized,
  }
}
