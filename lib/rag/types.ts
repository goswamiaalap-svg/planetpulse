/**
 * lib/rag/types.ts
 * Core types for PlanetPulse RAG pipeline, Guardrails, Observability & Evaluation
 */

import { KnowledgeChunk } from './ingestion/loader'
import { UserContext } from './context/userContext'

export interface CitationSource {
  title: string
  url: string
  name: string
}

export type DomainCategory =
  | 'carbon_tracking'
  | 'transportation'
  | 'energy_utilities'
  | 'diet_food'
  | 'emission_factors'
  | 'weekly_targets'
  | 'what_if_simulation'
  | 'user_history_stats'
  | 'out_of_domain'
  | 'adversarial_injection'

export interface DomainDecision {
  isAllowed: boolean
  category: DomainCategory
  confidence: number
  refusalReason?: string
  normalizedQuery: string
  isAdversarial?: boolean
}

export interface RetrievalMetrics {
  retrievalLatencyMs: number
  chunksCount: number
  topScore: number
  meanScore: number
  similarityThreshold: number
  thresholdPassed: boolean
  selectedChunkIds: string[]
}

export interface LatencyBreakdown {
  domainGateMs: number
  queryEmbeddingMs: number
  retrievalMs: number
  rerankMs?: number
  contextBuildMs: number
  llmFirstTokenMs?: number
  llmGenerationMs: number
  outputValidationMs: number
  totalMs: number
}

export interface OutputValidationResult {
  isValid: boolean
  violations: string[]
  sanitizedAnswer?: string
  checkedFactsCount: number
  unsupportedClaimsCount: number
}

export interface CoachResponse {
  answer: string
  summary: string
  recommendations: string[]
  reason: string
  sources: CitationSource[]
  intent: string
  grounded: boolean
  trace?: RagRequestTrace
}

export type CoachStreamEvent =
  | { type: 'status'; stage: string; message: string }
  | { type: 'token'; token: string }
  | { type: 'done'; response: CoachResponse }
  | { type: 'error'; error: string }

export interface RagRequestTrace {
  requestId: string
  timestamp: string
  query: string
  normalizedQuery: string
  domainDecision: DomainDecision
  retrievalMetrics: RetrievalMetrics
  retrievedChunks: Array<{
    id: string
    title: string
    sourceName: string
    score: number
  }>
  generationMethod: 'llm_openrouter' | 'llm_openai' | 'deterministic_template' | 'domain_refusal' | 'retrieval_abstention'
  validationResult: OutputValidationResult
  latency: LatencyBreakdown
  finalDecision: 'answered' | 'rejected_out_of_domain' | 'abstained_insufficient_context' | 'fallback_deterministic'
}
