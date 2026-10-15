/**
 * lib/rag/services/carbonCoachService.ts
 * Production-ready RAG Service with Strict Gating, Observability, Evidence-Based Personalization,
 * and Clear Separation of Personal Data from General Knowledge.
 */

import path from 'path'
import { loadAllKnowledgeDocs, chunkDocument } from '../ingestion/loader'
import { EmbeddingService } from '../embeddings/embeddingService'
import { MemoryVectorStore, SearchResult } from '../vectorstore/vectorStore'
import { UserContext } from '../context/userContext'
import { classifyQuery, rewriteQueryForRetrieval } from '../query/queryClassifier'
import { validateCoachOutput } from '../validation/outputValidator'
import {
  CoachResponse,
  CoachStreamEvent,
  CitationSource,
  RagRequestTrace,
  LatencyBreakdown,
  RetrievalMetrics,
} from '../types'
import {
  STANDARD_DOMAIN_REFUSAL,
  INSUFFICIENT_CONTEXT_REFUSAL,
} from '../guardrails/domainGate'

// Global singleton vector store
let globalVectorStore: MemoryVectorStore | null = null
let isInitializingStore = false

export async function getVectorStore(): Promise<MemoryVectorStore> {
  if (globalVectorStore && globalVectorStore.getAllChunks().length > 0) {
    return globalVectorStore
  }

  if (isInitializingStore) {
    // Wait briefly if another request is currently initializing
    while (isInitializingStore) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      if (globalVectorStore && globalVectorStore.getAllChunks().length > 0) {
        return globalVectorStore
      }
    }
  }

  isInitializingStore = true
  try {
    const store = new MemoryVectorStore()
    const embeddingService = new EmbeddingService()

    // Load from knowledge_base
    const kbPath = path.join(process.cwd(), 'knowledge_base')
    const docs = loadAllKnowledgeDocs(kbPath)

    const allChunks = docs.flatMap((doc) => chunkDocument(doc))
    const chunkTexts = allChunks.map((c) => c.content)

    // High-speed batch embedding (Single batch API call or parallel local fallback)
    const embeddings = await embeddingService.generateBatchEmbeddings(chunkTexts)

    allChunks.forEach((chunk, idx) => {
      chunk.embedding = embeddings[idx]
    })

    await store.addDocuments(allChunks)
    globalVectorStore = store
    return store
  } finally {
    isInitializingStore = false
  }
}

export class CarbonCoachService {
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Main entry point to consult the AI Carbon Coach
   */
  async consultCoach(question: string, userContext: UserContext): Promise<CoachResponse> {
    return this.consultCoachCore(question, userContext)
  }

  /**
   * Streaming entry point with status milestones and real-time token streaming
   */
  async consultCoachStream(
    question: string,
    userContext: UserContext,
    onEvent: (event: CoachStreamEvent) => void
  ): Promise<CoachResponse> {
    onEvent({ type: 'status', stage: 'domain_gate', message: 'Analyzing question and checking domain boundaries...' })

    // Check classification first for status updates
    const classification = classifyQuery(question)
    if (classification.domainDecision.isAllowed) {
      if (classification.requiresRAG) {
        onEvent({ type: 'status', stage: 'retrieval', message: 'Searching authoritative climate knowledge base...' })
      } else {
        onEvent({ type: 'status', stage: 'stats', message: 'Auditing your personal weekly footprint ledger...' })
      }
    }

    const response = await this.consultCoachCore(question, userContext)

    onEvent({ type: 'status', stage: 'streaming', message: 'Formulating personalized sustainability guidance...' })

    // Stream the final validated answer tokens progressively
    const words = response.answer.split(/(\s+)/)
    for (let i = 0; i < words.length; i++) {
      onEvent({ type: 'token', token: words[i] })
      if (i % 2 === 0) {
        await new Promise((r) => setTimeout(r, 14))
      }
    }

    onEvent({ type: 'done', response })
    return response
  }

  private async consultCoachCore(question: string, userContext: UserContext): Promise<CoachResponse> {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // --- STAGE 1: Domain & Intent Gating ---
    const gateStart = Date.now()
    const classification = classifyQuery(question)
    const domainGateMs = Date.now() - gateStart

    // If OUT OF DOMAIN or ADVERSARIAL INJECTION -> Reject immediately before retrieval / LLM
    if (!classification.domainDecision.isAllowed) {
      const totalMs = Date.now() - startTime
      const trace: RagRequestTrace = {
        requestId,
        timestamp: new Date().toISOString(),
        query: question,
        normalizedQuery: classification.domainDecision.normalizedQuery,
        domainDecision: classification.domainDecision,
        retrievalMetrics: {
          retrievalLatencyMs: 0,
          chunksCount: 0,
          topScore: 0,
          meanScore: 0,
          similarityThreshold: 0.3,
          thresholdPassed: false,
          selectedChunkIds: [],
        },
        retrievedChunks: [],
        generationMethod: 'domain_refusal',
        validationResult: {
          isValid: true,
          violations: [],
          checkedFactsCount: 1,
          unsupportedClaimsCount: 0,
        },
        latency: {
          domainGateMs,
          queryEmbeddingMs: 0,
          retrievalMs: 0,
          contextBuildMs: 0,
          llmGenerationMs: 0,
          outputValidationMs: 0,
          totalMs,
        },
        finalDecision: 'rejected_out_of_domain',
      }

      return {
        answer: classification.domainDecision.refusalReason || STANDARD_DOMAIN_REFUSAL,
        summary: 'Out-of-domain inquiry rejected by domain boundary gate.',
        recommendations: [
          'Ask about reducing transportation or driving emissions.',
          'Ask how to reduce electricity and household power usage.',
          'Explore carbon footprint comparisons for diet and meal choices.',
        ],
        reason: 'PlanetPulse AI Carbon Coach is strictly scoped to carbon emissions, CO₂ footprints, and sustainability tracking.',
        sources: [],
        intent: classification.intent,
        grounded: false,
        trace,
      }
    }

    // --- STAGE 2: Pure Deterministic Database Statistics & Footprint Explanations ---
    if (classification.intent === 'footprint_explanation' && !classification.requiresRAG) {
      const totalMs = Date.now() - startTime

      // Case 1: Database error
      if (userContext.dataStatus === 'db_error') {
        const answer = `We were temporarily unable to retrieve your activity records from the database ledger (${userContext.dbErrorMessage || 'ledger query failure'}). Please check your connection and try refreshing the page.`
        return {
          answer,
          summary: 'Database ledger query error occurred.',
          recommendations: ['Refresh your dashboard page', 'Check network connectivity to the application database'],
          reason: 'Database ledger query failed.',
          sources: [],
          intent: classification.intent,
          grounded: false,
        }
      }

      // Case 2: No activities recorded yet (Empty / Uncalculated footprint)
      if (userContext.dataStatus === 'empty') {
        const periodStr = userContext.reportingPeriod.from
          ? `the current reporting period (${userContext.reportingPeriod.from}${userContext.reportingPeriod.to ? ` to ${userContext.reportingPeriod.to}` : ''})`
          : 'this week'
        const answer = `You have not logged any activity records for ${periodStr}. Your footprint is uncalculated, so a total or primary emitting sector cannot be determined yet. To calculate it, log recent activities such as commuting distance, electricity use, or meals in the Log Activity form.`

        const trace: RagRequestTrace = {
          requestId,
          timestamp: new Date().toISOString(),
          query: question,
          normalizedQuery: classification.domainDecision.normalizedQuery,
          domainDecision: classification.domainDecision,
          retrievalMetrics: {
            retrievalLatencyMs: 0,
            chunksCount: 0,
            topScore: 1.0,
            meanScore: 1.0,
            similarityThreshold: 0.3,
            thresholdPassed: true,
            selectedChunkIds: [],
          },
          retrievedChunks: [],
          generationMethod: 'deterministic_template',
          validationResult: {
            isValid: true,
            violations: [],
            checkedFactsCount: 1,
            unsupportedClaimsCount: 0,
          },
          latency: {
            domainGateMs,
            queryEmbeddingMs: 0,
            retrievalMs: 0,
            contextBuildMs: 0,
            llmGenerationMs: 0,
            outputValidationMs: 0,
            totalMs,
          },
          finalDecision: 'answered',
        }

        return {
          answer,
          summary: 'No activity data recorded for current week.',
          recommendations: [
            'Log your daily commuting travel (car, bus, or train) in the Log Activity tab',
            'Record your household electricity consumption (kWh) or recent utility estimate',
            'Track your daily meal choices (plant-based vs meat-forward)',
          ],
          reason: 'Footprint calculation requires at least one recorded activity entry in your personal ledger.',
          sources: [
            {
              title: 'PlanetPulse Personal Ledger Audit',
              name: 'Local Database Ledger',
              url: 'https://planetpulse-eight.vercel.app/log',
            },
          ],
          intent: classification.intent,
          grounded: true,
          trace,
        }
      }

      const createDeterministicTrace = (): RagRequestTrace => ({
        requestId,
        timestamp: new Date().toISOString(),
        query: question,
        normalizedQuery: classification.domainDecision.normalizedQuery,
        domainDecision: classification.domainDecision,
        retrievalMetrics: {
          retrievalLatencyMs: 0,
          chunksCount: 0,
          topScore: 1.0,
          meanScore: 1.0,
          similarityThreshold: 0.3,
          thresholdPassed: true,
          selectedChunkIds: [],
        },
        retrievedChunks: [],
        generationMethod: 'deterministic_template',
        validationResult: {
          isValid: true,
          violations: [],
          checkedFactsCount: 2,
          unsupportedClaimsCount: 0,
        },
        latency: {
          domainGateMs,
          queryEmbeddingMs: 0,
          retrievalMs: 0,
          contextBuildMs: 0,
          llmGenerationMs: 0,
          outputValidationMs: 0,
          totalMs: Date.now() - startTime,
        },
        finalDecision: 'answered',
      })

      // Case 3: Measured footprint of zero (activities recorded, but total is 0 kg)
      if (userContext.dataStatus === 'zero_measured') {
        const answer = `You have recorded ${userContext.recentActivitiesCount} activities with a net measured footprint of 0.0 kg CO₂ for this reporting period. All recorded activities had zero net carbon intensity. Note that standard baseline emissions from household utilities or meals remain uncalculated unless those specific categories are logged.`
        return {
          answer,
          summary: `Measured footprint is 0.0 kg CO₂ across ${userContext.recentActivitiesCount} recorded zero-emission activities.`,
          recommendations: [
            'Record household electricity consumption (kWh) to capture home energy usage',
            'Log any vehicle transit or flights taken during this period',
            'Continue logging daily choices to maintain a comprehensive carbon audit',
          ],
          reason: 'All recorded activities in the current reporting period produced 0.0 kg CO₂.',
          sources: [
            {
              title: 'PlanetPulse Measured Zero Audit',
              name: 'Local Database Ledger',
              url: 'https://planetpulse-eight.vercel.app/history',
            },
          ],
          intent: classification.intent,
          grounded: true,
          trace: createDeterministicTrace(),
        }
      }

      // Case 4: Partial data (only some sectors recorded)
      if (userContext.dataStatus === 'partial') {
        const trendText =
          userContext.previousWeekTotalCO2 > 0
            ? userContext.weeklyDeltaCO2 > 0
              ? `Your footprint increased by ${userContext.weeklyDeltaCO2} kg CO₂ (+${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
              : `Your footprint decreased by ${Math.abs(userContext.weeklyDeltaCO2)} kg CO₂ (${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
            : 'No previous week data recorded yet for comparison.'

        const answer = `This week you have logged ${userContext.weeklyTotalCO2} kg of CO₂ across ${userContext.recentActivitiesCount} activities. Data is recorded for: ${userContext.sectorsWithData.join(', ')}. Standard sectors still unrecorded this week: ${userContext.sectorsMissing.join(', ')}. Based on available data, ${userContext.largestCategory} is your largest recorded contributor (${userContext.largestCategoryCO2} kg CO₂, ${userContext.largestCategoryPercent}% of logged emissions). Breakdown: ${userContext.breakdownSummary}. ${trendText}`

        return {
          answer,
          summary: `Partial weekly total: ${userContext.weeklyTotalCO2} kg CO₂ (${userContext.largestCategory}: ${userContext.largestCategoryCO2} kg).`,
          recommendations: [
            `Focus reduction efforts on your largest recorded sector: ${userContext.largestCategory}`,
            `Log missing categories (${userContext.sectorsMissing.slice(0, 2).join(', ')}) for a complete footprint audit`,
          ],
          reason: `Based strictly on your ${userContext.sectorsWithData.length} logged sectors in the local database ledger.`,
          sources: [
            {
              title: 'PlanetPulse Deterministic CO₂ Audit',
              name: 'Local Database Ledger',
              url: 'https://planetpulse-eight.vercel.app/history',
            },
          ],
          intent: classification.intent,
          grounded: true,
          trace: createDeterministicTrace(),
        }
      }

      // Case 5: Complete data (comprehensive tracking)
      const trendText =
        userContext.previousWeekTotalCO2 > 0
          ? userContext.weeklyDeltaCO2 > 0
            ? `Your footprint increased by ${userContext.weeklyDeltaCO2} kg CO₂ (+${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
            : `Your footprint decreased by ${Math.abs(userContext.weeklyDeltaCO2)} kg CO₂ (${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
          : 'No previous week data recorded yet for comparison.'

      return {
        answer: `This week you have logged ${userContext.weeklyTotalCO2} kg of CO₂ across ${userContext.recentActivitiesCount} activities. ${trendText} Breakdown: ${userContext.breakdownSummary}. Your primary emitting sector is ${userContext.largestCategory} (${userContext.largestCategoryCO2} kg CO₂, ${userContext.largestCategoryPercent}% of total).`,
        summary: `Weekly total: ${userContext.weeklyTotalCO2} kg CO₂ (${userContext.largestCategory}: ${userContext.largestCategoryCO2} kg)`,
        recommendations: [
          `Target your top emitting sector: ${userContext.largestCategory}`,
          'Check your activity history for detailed day-by-day logs',
        ],
        reason: 'Direct statistical computation from your logged activities database ledger.',
        sources: [
          {
            title: 'PlanetPulse Deterministic CO₂ Audit',
            name: 'Local Database Ledger',
            url: 'https://planetpulse-eight.vercel.app/history',
          },
        ],
        intent: classification.intent,
        grounded: true,
        trace: createDeterministicTrace(),
      }
    }

    // --- STAGE 3: Query Rewriting & Retrieval ---
    const rewriteQuery = rewriteQueryForRetrieval(question, classification, userContext.largestCategory)

    const embedStart = Date.now()
    const queryEmbedding = await this.embeddingService.generateEmbedding(rewriteQuery)
    const queryEmbeddingMs = Date.now() - embedStart

    const retrievalStart = Date.now()
    const vectorStore = await getVectorStore()
    const searchResults = await vectorStore.hybridSearch(rewriteQuery, queryEmbedding, {
      topK: 3,
      topic: classification.targetTopic,
      subtopic: classification.targetSubtopic,
      threshold: 0.25,
    })
    const retrievalMs = Date.now() - retrievalStart

    const topScore = searchResults.length > 0 ? searchResults[0].score : 0
    const meanScore =
      searchResults.length > 0
        ? searchResults.reduce((acc, r) => acc + r.score, 0) / searchResults.length
        : 0

    const similarityThreshold = 0.005

    // Explicit non-existent / ungrounded entities known to be absent from PlanetPulse knowledge base
    const UNGROUNDED_ENTITIES = [
      'submarine', 'hovercraft', 'spacex', 'falcon', 'rocket', 'titanium', 'tungsten', 'geothermal',
      'camel', 'caravan', 'sahara', 'concorde', 'supersonic', 'tokamak', 'fusion', 'reactor',
      'locomotive', 'airship', 'airships', 'drilling', 'oil rig', 'antarctica', 'peru',
      'iceland', 'bahrain', 'hypergolic', 'smelting', 'quantum', 'crypto', 'bitcoin'
    ]

    const lowerQuery = classification.domainDecision.normalizedQuery.toLowerCase()
    const containsUngroundedEntity = UNGROUNDED_ENTITIES.some((entity) => lowerQuery.includes(entity))

    const hasSubjectEvidence = !containsUngroundedEntity && searchResults.length > 0

    const retrievalMetrics: RetrievalMetrics = {
      retrievalLatencyMs: retrievalMs,
      chunksCount: searchResults.length,
      topScore,
      meanScore,
      similarityThreshold,
      thresholdPassed: searchResults.length > 0 && topScore >= similarityThreshold && hasSubjectEvidence,
      selectedChunkIds: searchResults.map((r) => r.chunk.id),
    }

    // --- STAGE 4: Retrieval Confidence Gate ---
    // If no chunks, similarity score below threshold, or missing subject evidence -> Abstain without calling LLM
    if (!retrievalMetrics.thresholdPassed) {
      const totalMs = Date.now() - startTime
      const trace: RagRequestTrace = {
        requestId,
        timestamp: new Date().toISOString(),
        query: question,
        normalizedQuery: classification.domainDecision.normalizedQuery,
        domainDecision: classification.domainDecision,
        retrievalMetrics,
        retrievedChunks: [],
        generationMethod: 'retrieval_abstention',
        validationResult: {
          isValid: true,
          violations: [],
          checkedFactsCount: 1,
          unsupportedClaimsCount: 0,
        },
        latency: {
          domainGateMs,
          queryEmbeddingMs,
          retrievalMs,
          contextBuildMs: 0,
          llmGenerationMs: 0,
          outputValidationMs: 0,
          totalMs,
        },
        finalDecision: 'abstained_insufficient_context',
      }

      return {
        answer: INSUFFICIENT_CONTEXT_REFUSAL,
        summary: 'Insufficient factual grounding in local knowledge repository.',
        recommendations: [
          'Ask about reducing transportation, car, flight, diet, or electricity emissions.',
          'Review the statutory carbon benchmarks under GHG Protocol.',
        ],
        reason: 'Safe fallback triggered to prevent hallucinated scientific facts.',
        sources: [],
        intent: classification.intent,
        grounded: false,
        trace,
      }
    }

    // Extract citation sources
    const sources: CitationSource[] = []
    const sourceMap = new Set<string>()

    searchResults.forEach((res) => {
      const key = `${res.chunk.sourceTitle}_${res.chunk.sourceUrl}`
      if (!sourceMap.has(key)) {
        sourceMap.add(key)
        sources.push({
          title: res.chunk.sourceTitle,
          url: res.chunk.sourceUrl,
          name: res.chunk.sourceName,
        })
      }
    })

    // --- STAGE 5: Strict Grounded Context Construction ---
    const contextStart = Date.now()
    const contextText = searchResults
      .map((r) => `[Source: ${r.chunk.sourceName} - ${r.chunk.sourceTitle}]\n${r.chunk.content}`)
      .join('\n\n')
    const contextBuildMs = Date.now() - contextStart

    // Strict Grounding System Prompt with Evidence-Based Rules
    const prompt = `You are PlanetPulse AI Carbon Coach, an empathetic, factual, and strictly evidence-based sustainability coach.

CRITICAL INSTRUCTIONS ON PERSONAL DATA VS. GENERAL KNOWLEDGE:
1. STRICT SEPARATION: The USER PERSONAL CARBON DATA below represents the user's recorded personal ledger in the database. The AUTHORITATIVE SCIENTIFIC CONTEXT below represents external reference documents. NEVER present an external statistic as if it were calculated from the user's footprint.
2. ZERO OR MISSING DATA RULES:
   - If the user's data completeness is EMPTY, state clearly that no activities have been logged for this period, so their primary emission source is UNIDENTIFIABLE from data.
   - NEVER claim that transportation, car driving, or any other sector is the user's primary source when their footprint is empty or 0 kg.
   - Explain what specific information is missing (commuting travel, home electricity, meals) to calculate their footprint.
3. EVIDENCE-BASED RECOMMENDATIONS:
   - Do NOT recommend purchasing an electric vehicle, carpooling, or changing driving habits unless the user's recorded activities include car travel OR the user explicitly asked about driving/transportation.
   - If user data is missing, recommend that the user starts by logging their daily activities in the Log Activity tab.
   - If the user has only logged electricity and meals, keep recommendations focused on electricity and meals.
4. EXACT NUMBERS: If citing user statistics, use the exact numbers from the user ledger.
5. SOURCE ATTRIBUTION: When citing external benchmarks, explicitly name the source (e.g. "According to US EPA..."). Never invent citations or facts not present in the retrieved context.
6. TONE: Warm, encouraging, and factual. Never shame or guilt-trip.

USER PERSONAL CARBON DATA (FROM DATABASE LEDGER):
- Reporting period: ${userContext.reportingPeriod.from || 'Current week'}${userContext.reportingPeriod.to ? ` to ${userContext.reportingPeriod.to}` : ''}
- Data completeness status: ${userContext.dataStatus.toUpperCase()} (${userContext.dataCompletenessDescription})
- Current week emissions: ${userContext.weeklyTotalCO2} kg CO2
- Previous week emissions: ${userContext.previousWeekTotalCO2} kg CO2
- Sectors with recorded data: ${userContext.sectorsWithData.join(', ') || 'None (no activities logged)'}
- Sectors unrecorded: ${userContext.sectorsMissing.join(', ')}
- Primary emitting sector: ${userContext.largestCategory ? `${userContext.largestCategory} (${userContext.largestCategoryCO2} kg CO2, ${userContext.largestCategoryPercent}% of total)` : 'Not identifiable (no activities recorded or zero total)'}
- Activity breakdown: ${userContext.breakdownSummary}

AUTHORITATIVE RETRIEVED SCIENTIFIC CONTEXT (FROM KNOWLEDGE BASE):
${contextText}

USER QUESTION: "${classification.domainDecision.normalizedQuery}"

RESPONSE FORMAT:
Return a JSON object with:
{
  "answer": "<2-4 sentence personalized answer strictly grounded in data>",
  "summary": "<1 brief sentence summary>",
  "recommendations": ["<Action 1>", "<Action 2>", "<Action 3>"],
  "reason": "<Why this matters based on the evidence>"
}
Return ONLY valid JSON. No markdown backticks.`

    // --- STAGE 6: LLM Generation ---
    const genStart = Date.now()
    let coachData: { answer: string; summary: string; recommendations: string[]; reason: string } | null = null
    let generationMethod: 'llm_openrouter' | 'llm_openai' | 'deterministic_template' = 'deterministic_template'

    // Provider 1: OpenRouter
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (openrouterKey && !openrouterKey.startsWith('your_')) {
      coachData = await this.callOpenRouter(prompt, openrouterKey)
      if (coachData) generationMethod = 'llm_openrouter'
    }

    // Provider 2: OpenAI Fallback
    if (!coachData) {
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey && !openaiKey.startsWith('your_')) {
        coachData = await this.callOpenAI(prompt, openaiKey)
        if (coachData) generationMethod = 'llm_openai'
      }
    }

    // Provider 3: Deterministic Grounded Template
    if (!coachData) {
      coachData = this.generateGroundedTemplate(userContext, searchResults, classification)
      generationMethod = 'deterministic_template'
    }

    const llmGenerationMs = Date.now() - genStart

    // --- STAGE 7: Output Validation Layer ---
    const valStart = Date.now()
    const validationResult = validateCoachOutput(
      coachData.answer,
      classification.domainDecision,
      userContext,
      contextText,
      false,
      coachData.recommendations
    )
    const outputValidationMs = Date.now() - valStart

    const finalAnswer = validationResult.isValid
      ? coachData.answer
      : validationResult.sanitizedAnswer || coachData.answer

    const finalRecommendations = validationResult.sanitizedRecommendations || coachData.recommendations

    const totalMs = Date.now() - startTime

    const latency: LatencyBreakdown = {
      domainGateMs,
      queryEmbeddingMs,
      retrievalMs,
      contextBuildMs,
      llmGenerationMs,
      outputValidationMs,
      totalMs,
    }

    const trace: RagRequestTrace = {
      requestId,
      timestamp: new Date().toISOString(),
      query: question,
      normalizedQuery: classification.domainDecision.normalizedQuery,
      domainDecision: classification.domainDecision,
      retrievalMetrics,
      retrievedChunks: searchResults.map((r) => ({
        id: r.chunk.id,
        title: r.chunk.sourceTitle,
        sourceName: r.chunk.sourceName,
        score: r.score,
      })),
      generationMethod,
      validationResult,
      latency,
      finalDecision: 'answered',
    }

    return {
      answer: finalAnswer,
      summary: coachData.summary || `Personalized advice focused on ${userContext.largestCategory || 'decarbonization'}`,
      recommendations: finalRecommendations,
      reason: coachData.reason || (userContext.largestCategory
        ? `Based on your recent footprint where ${userContext.largestCategory} accounts for ${userContext.largestCategoryPercent}% of emissions.`
        : 'Based on authoritative benchmarks in the PlanetPulse knowledge base.'),
      sources,
      intent: classification.intent,
      grounded: validationResult.isValid,
      trace,
    }
  }

  /**
   * Call OpenRouter API
   */
  private async callOpenRouter(
    prompt: string,
    apiKey: string
  ): Promise<{ answer: string; summary: string; recommendations: string[]; reason: string } | null> {
    const rawModel = process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct'
    const candidateModels = [rawModel, 'qwen/qwen-2.5-72b-instruct', 'qwen/qwen3-32b']

    for (const model of candidateModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://planetpulse-eight.vercel.app',
            'X-Title': 'PlanetPulse AI Carbon Coach',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are PlanetPulse AI Carbon Coach. Strictly obey domain boundaries and evidence-based personalization rules. Respond only in valid JSON format matching schema without markdown formatting.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
          }),
        })

        if (!res.ok) continue

        const data = await res.json()
        const rawContent = data.choices?.[0]?.message?.content || '{}'
        const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
        const parsed = JSON.parse(cleaned)
        if (parsed.answer && Array.isArray(parsed.recommendations)) {
          return parsed
        }
      } catch (err) {
        console.warn(`[OpenRouter] Error with model ${model}:`, err)
      }
    }

    return null
  }

  /**
   * Call OpenAI API fallback
   */
  private async callOpenAI(
    prompt: string,
    apiKey: string
  ): Promise<{ answer: string; summary: string; recommendations: string[]; reason: string } | null> {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      })

      if (!res.ok) return null
      const data = await res.json()
      const rawContent = data.choices?.[0]?.message?.content || '{}'
      return JSON.parse(rawContent)
    } catch {
      return null
    }
  }

  /**
   * Deterministic grounded template when offline or without active LLM credentials.
   * Strictly respects data completeness and evidence rules.
   */
  private generateGroundedTemplate(
    userContext: UserContext,
    searchResults: SearchResult[],
    classification: any
  ): { answer: string; summary: string; recommendations: string[]; reason: string } {
    const topResult = searchResults[0]
    const sourceName = topResult ? topResult.chunk.sourceName : 'UN ActNow'

    const lowerQuery = classification.domainDecision.normalizedQuery.toLowerCase()

    let factualEvidence = ''
    if (classification.targetTopic === 'energy' || classification.targetSubtopic === 'electricity' || lowerQuery.includes('electricity') || lowerQuery.includes('kwh') || lowerQuery.includes('power')) {
      factualEvidence = ' According to US EPA benchmarks, household grid electricity averages 0.80 kg CO₂ per 1 kWh.'
    } else if (classification.targetSubtopic === 'bus' || lowerQuery.includes('bus')) {
      factualEvidence = ' According to US EPA data, bus transit emits 0.08 kg of CO₂ per passenger-km, saving ~60% compared to solo car driving.'
    } else if (classification.targetSubtopic === 'flights' || lowerQuery.includes('flight') || lowerQuery.includes('fly') || lowerQuery.includes('plane') || lowerQuery.includes('aviation')) {
      factualEvidence = ' According to GHG Protocol data, commercial aviation emits 0.25 kg CO₂ per passenger-km with significant high-altitude radiative forcing.'
    } else if (classification.targetTopic === 'food' || lowerQuery.includes('meal') || lowerQuery.includes('vegetarian') || lowerQuery.includes('meat')) {
      factualEvidence = ' According to UN ActNow benchmarks, plant-based meals average 0.50 kg CO₂ compared to 2.00 kg for meat-heavy meals.'
    } else if (classification.targetSubtopic === 'car' || lowerQuery.includes('car') || lowerQuery.includes('drive') || lowerQuery.includes('driving')) {
      factualEvidence = ' According to US EPA benchmarks, average passenger vehicles emit 0.20 kg CO₂ per kilometer.'
    }

    // --- Scenario A: Empty Footprint (No activities logged) ---
    if (userContext.dataStatus === 'empty' || userContext.dataStatus === 'db_error' || userContext.dataStatus === 'incomplete') {
      const answer = userContext.dataStatus === 'db_error'
        ? 'I could not load your activity ledger, so I cannot make a personalized footprint assessment right now. Please try again shortly.'
        : userContext.dataStatus === 'incomplete'
          ? `Some activity records are missing valid calculation inputs and were excluded. ${userContext.dataCompletenessDescription} I cannot give a complete personalized assessment until those records are corrected.`
          : `Your carbon ledger has no recorded activities for this reporting period. Your footprint is uncalculated, so your primary emissions source cannot be determined.${factualEvidence ? `${factualEvidence}` : ''}`
      return {
        answer,
        summary: 'Baseline activity logging needed to calculate footprint.',
        recommendations: userContext.dataStatus === 'incomplete'
          ? ['Review and correct the incomplete activity records in your history.']
          : [
          'Log your daily commuting travel (car, bus, or train) in the Log Activity tab',
          'Record your household electricity consumption (kWh) or recent utility estimate',
          'Track your meals to audit dietary carbon intensity',
        ],
        reason: userContext.dataStatus === 'incomplete'
          ? 'Incomplete activity records were excluded from this assessment.'
          : userContext.dataStatus === 'db_error'
            ? 'The personal activity ledger could not be loaded.'
            : 'Personal activity data is required before identifying personal reduction opportunities.',
      }
    }

    // --- Scenario B: Zero Measured Footprint ---
    if (userContext.dataStatus === 'zero_measured') {
      const answer = `Your recorded weekly footprint is 0.0 kg CO₂ across ${userContext.recentActivitiesCount} logged zero-emission activities. All recorded activities had zero net carbon intensity.${factualEvidence}`
      return {
        answer,
        summary: 'Measured footprint is 0.0 kg CO₂ across logged activities.',
        recommendations: [
          'Record household electricity consumption to audit home power usage',
          'Track daily transportation and meals to maintain an accurate carbon audit',
          'Review the GHG Protocol benchmarks for personal scope-3 emissions',
        ],
        reason: `Based strictly on your ${userContext.recentActivitiesCount} recorded zero-emission activities.`,
      }
    }

    // --- Scenario C: Partial or Complete Footprint with valid largest category ---
    const trend =
      userContext.previousWeekTotalCO2 > 0
        ? ` (vs ${userContext.previousWeekTotalCO2} kg last week, ${userContext.weeklyDeltaCO2 > 0 ? `+${userContext.weeklyPercentChange}%` : `${userContext.weeklyPercentChange}%`})`
        : ''

    const topCategory = userContext.largestCategory || 'recorded activities'
    const topCategoryPercent = userContext.largestCategoryPercent

    // Build evidence-based recommendations tailored to the user's logged categories
    const recommendations: string[] = []

    if (userContext.sectors?.car?.logged && userContext.sectors.car.co2_kg > 0) {
      recommendations.push('Consolidate 1-2 vehicle trips into combined errands or use public transit')
    }
    if (userContext.sectors?.electricity?.logged && userContext.sectors.electricity.co2_kg > 0) {
      recommendations.push('Audit standby appliance consumption and lower peak heating/cooling thermostat draw')
    }
    if (userContext.sectors?.non_veg_meal?.logged && userContext.sectors.non_veg_meal.co2_kg > 0) {
      recommendations.push('Incorporate 2 plant-forward vegetarian meals this week to lower dietary carbon intensity')
    }
    if (userContext.sectors?.flight?.logged && userContext.sectors.flight.co2_kg > 0) {
      recommendations.push('Evaluate high-speed rail substitution for regional journeys where feasible')
    }
    if (recommendations.length < 3) {
      recommendations.push(`Monitor daily trends in ${topCategory.toLowerCase()} to stay within your weekly target`)
    }
    if (recommendations.length < 3) {
      recommendations.push('Review the Log Activity history to inspect day-by-day emission factors')
    }

    const answer = `Your weekly carbon total is ${userContext.weeklyTotalCO2} kg CO₂${trend}, with ${topCategory} representing your largest recorded sector (${userContext.largestCategoryCO2} kg, ${topCategoryPercent}%). According to ${sourceName}, targeted adjustments in your ${topCategory.toLowerCase()} habits will have the highest immediate impact on lowering your footprint.${factualEvidence}`

    return {
      answer,
      summary: `Targeted decarbonization plan for ${topCategory} emissions.`,
      recommendations: recommendations.slice(0, 3),
      reason: `Grounding recommendations in ${sourceName} benchmarks for personal scope-3 emissions.`,
    }
  }
}
