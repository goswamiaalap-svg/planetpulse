import path from 'path'
import { loadAllKnowledgeDocs, chunkDocument } from '../ingestion/loader'
import { EmbeddingService } from '../embeddings/embeddingService'
import { MemoryVectorStore, VectorStore, SearchResult } from '../vectorstore/vectorStore'
import { UserContext } from '../context/userContext'
import { classifyQuery, rewriteQueryForRetrieval } from '../query/queryClassifier'

export interface CitationSource {
  title: string
  url: string
  name: string
}

export interface CoachResponse {
  answer: string
  summary: string
  recommendations: string[]
  reason: string
  sources: CitationSource[]
  intent: string
  grounded: boolean
}

// Global singleton vector store
let globalVectorStore: MemoryVectorStore | null = null

export async function getVectorStore(): Promise<MemoryVectorStore> {
  if (globalVectorStore && globalVectorStore.getAllChunks().length > 0) {
    return globalVectorStore
  }

  const store = new MemoryVectorStore()
  const embeddingService = new EmbeddingService()

  // Load from knowledge_base
  const kbPath = path.join(process.cwd(), 'knowledge_base')
  const docs = loadAllKnowledgeDocs(kbPath)

  for (const doc of docs) {
    const chunks = chunkDocument(doc)
    for (const chunk of chunks) {
      chunk.embedding = await embeddingService.generateEmbedding(chunk.content)
    }
    await store.addDocuments(chunks)
  }

  globalVectorStore = store
  return store
}

export class CarbonCoachService {
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  /**
   * Main entry point to ask the AI Carbon Coach
   */
  async consultCoach(question: string, userContext: UserContext): Promise<CoachResponse> {
    const classification = classifyQuery(question)

    // 1. If purely deterministic database explanation, handle without LLM/RAG hallucination
    if (classification.intent === 'footprint_explanation' && !classification.requiresRAG) {
      return {
        answer: `This week you have logged ${userContext.weeklyTotalCO2} kg of CO₂ across ${userContext.recentActivitiesCount} activities. Your target is ${userContext.weeklyTarget ?? 'not set'} kg CO₂. Breakdown: ${userContext.breakdownSummary || 'No data logged yet'}.`,
        summary: `Weekly total: ${userContext.weeklyTotalCO2} kg CO₂`,
        recommendations: [
          `Review your top contributor: ${userContext.largestCategory}`,
          'Check your activity history for detailed day-by-day logs',
        ],
        reason: 'Direct statistical computation from your logged activities database.',
        sources: [
          {
            title: 'PlanetPulse Deterministic CO₂ Audit',
            name: 'Local Database Ledger',
            url: 'https://planetpulse-eight.vercel.app/history',
          },
        ],
        intent: classification.intent,
        grounded: true,
      }
    }

    // 2. Hybrid Retrieval with Query Rewriting
    const rewrittenQuery = rewriteQueryForRetrieval(question, classification, userContext.largestCategory)
    const queryEmbedding = await this.embeddingService.generateEmbedding(rewrittenQuery)

    const vectorStore = await getVectorStore()
    const searchResults = await vectorStore.hybridSearch(rewrittenQuery, queryEmbedding, {
      topK: 3,
      topic: classification.targetTopic,
      subtopic: classification.targetSubtopic,
    })

    // Extract sources
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

    // If insufficient context, return safe fallback
    if (searchResults.length === 0) {
      return {
        answer: "I don't have enough verified climate data in my authoritative knowledge base to answer that specific inquiry accurately.",
        summary: 'Insufficient factual grounding in local knowledge repository.',
        recommendations: [
          'Ask about reducing transportation, car, flight, diet, or electricity emissions.',
          'Review the statutory carbon benchmarks under GHG Protocol.',
        ],
        reason: 'Safe fallback triggered to prevent hallucinated scientific facts.',
        sources: [],
        intent: classification.intent,
        grounded: false,
      }
    }

    const contextText = searchResults
      .map((r) => `[Source: ${r.chunk.sourceName} - ${r.chunk.sourceTitle}]\n${r.chunk.content}`)
      .join('\n\n')

    // 3. Call LLM with strict grounding prompt
    const prompt = `You are PlanetPulse AI Carbon Coach, a factual, supportive, and non-judgmental climate coach.
User question: "${question}"

User carbon footprint context:
- Weekly emissions: ${userContext.weeklyTotalCO2} kg CO2
- Weekly target: ${userContext.weeklyTarget ? `${userContext.weeklyTarget} kg` : 'None'}
- Target status: ${userContext.isOverTarget ? `Exceeded target by ${userContext.targetExceededBy} kg (${userContext.percentTargetUsed}%)` : 'Within weekly budget'}
- Primary emitting sector: ${userContext.largestCategory} (${userContext.largestCategoryCO2} kg CO2, ${userContext.largestCategoryPercent}% of total)
- Activity breakdown: ${userContext.breakdownSummary}

Authoritative retrieved scientific context:
${contextText}

Instructions:
1. Answer warmly, encouragingly, and practically. NEVER shame or judge the user.
2. Ground all factual statements STRICTLY in the retrieved context. Do not invent emission factors or statistics.
3. Cite the retrieved source names (e.g. UN ActNow, US EPA, GHG Protocol) naturally in your explanation.
4. Provide exactly 2 to 3 practical, actionable recommendations tailored to the user's primary emission contributor.
5. Return your response as a valid JSON object matching this structure:
{
  "answer": "<2-3 sentence personalized answer>",
  "summary": "<1 brief sentence summary>",
  "recommendations": ["<Action 1>", "<Action 2>", "<Action 3>"],
  "reason": "<Why this matters based on the retrieved context and user footprint>"
}
Return ONLY valid JSON. No markdown backticks, no preamble.`

    let coachData: { answer: string; summary: string; recommendations: string[]; reason: string }

    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey && !apiKey.startsWith('your_')) {
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
            temperature: 0.3,
          }),
        })

        const data = await res.json()
        const rawContent = data.choices?.[0]?.message?.content || '{}'
        coachData = JSON.parse(rawContent)
      } catch (err) {
        console.warn('[CarbonCoachService] LLM API call failed, generating grounded template:', err)
        coachData = this.generateGroundedTemplate(userContext, searchResults)
      }
    } else {
      coachData = this.generateGroundedTemplate(userContext, searchResults)
    }

    return {
      answer: coachData.answer || 'Here is your personalized sustainability guidance based on verified climate research.',
      summary: coachData.summary || `Personalized advice focused on ${userContext.largestCategory}`,
      recommendations: coachData.recommendations || [
        'Consolidate short vehicle trips into combined errands',
        'Substitute one red meat meal with lentils or beans',
        'Turn down thermostat by 1°C to save heating power',
      ],
      reason: coachData.reason || `Based on your recent footprint where ${userContext.largestCategory} accounts for ${userContext.largestCategoryPercent}% of emissions.`,
      sources,
      intent: classification.intent,
      grounded: true,
    }
  }

  /**
   * Deterministic grounded template when offline or without active LLM credentials
   */
  private generateGroundedTemplate(
    userContext: UserContext,
    searchResults: SearchResult[]
  ): { answer: string; summary: string; recommendations: string[]; reason: string } {
    const topResult = searchResults[0]
    const sourceName = topResult ? topResult.chunk.sourceName : 'UN ActNow'

    return {
      answer: `Your weekly carbon total is ${userContext.weeklyTotalCO2} kg CO₂, with ${userContext.largestCategory} representing your largest sector (${userContext.largestCategoryPercent}%). According to ${sourceName}, practical shifts in your daily routine can yield immediate reductions without sacrificing convenience.`,
      summary: `Targeted decarbonization plan for ${userContext.largestCategory} emissions.`,
      recommendations: [
        `Replace 1-2 short trips currently taken by ${userContext.largestCategory} with walking, cycling, or transit`,
        'Incorporate 2 plant-forward vegetarian meals this week to lower dietary carbon intensity',
        'Audit standby appliance consumption and lower peak heating/cooling draws',
      ],
      reason: `Grounding recommendations in ${sourceName} benchmarks for personal scope-3 emissions.`,
    }
  }
}
