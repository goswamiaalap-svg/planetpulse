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

    // 1. If purely deterministic database explanation without reduction questions, handle with exact stats
    if (classification.intent === 'footprint_explanation' && !classification.requiresRAG) {
      const trendText =
        userContext.previousWeekTotalCO2 > 0
          ? userContext.weeklyDeltaCO2 > 0
            ? `Your footprint increased by ${userContext.weeklyDeltaCO2} kg CO₂ (+${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
            : `Your footprint decreased by ${Math.abs(userContext.weeklyDeltaCO2)} kg CO₂ (${userContext.weeklyPercentChange}%) compared to last week (${userContext.previousWeekTotalCO2} kg CO₂).`
          : 'No previous week data recorded yet for comparison.'

      return {
        answer: `This week you have logged ${userContext.weeklyTotalCO2} kg of CO₂ across ${userContext.recentActivitiesCount} activities. ${trendText} Breakdown: ${userContext.breakdownSummary || 'No data logged yet'}.`,
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

    // If insufficient context and not a general reasoning question, return safe fallback
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

    // 3. Construct strictly grounded prompt with exact user footprint data
    const prompt = `You are PlanetPulse AI Carbon Coach, an empathetic, factual, and non-judgmental climate coach.
User question: "${question}"

User carbon footprint data (from database):
- Current week emissions: ${userContext.weeklyTotalCO2} kg CO2
- Previous week emissions: ${userContext.previousWeekTotalCO2} kg CO2
- Week-over-week trend: ${userContext.previousWeekTotalCO2 > 0 ? (userContext.weeklyDeltaCO2 > 0 ? `Increased by ${userContext.weeklyDeltaCO2} kg (+${userContext.weeklyPercentChange}%)` : `Decreased by ${Math.abs(userContext.weeklyDeltaCO2)} kg (${userContext.weeklyPercentChange}%)`) : 'First week of tracking'}
- Weekly target: ${userContext.weeklyTarget ? `${userContext.weeklyTarget} kg` : 'None'}
- Target status: ${userContext.isOverTarget ? `Exceeded target by ${userContext.targetExceededBy} kg (${userContext.percentTargetUsed}% of target)` : 'Within weekly budget'}
- Primary emitting sector: ${userContext.largestCategory} (${userContext.largestCategoryCO2} kg CO2, ${userContext.largestCategoryPercent}% of total)
- Activity breakdown: ${userContext.breakdownSummary}

Authoritative retrieved scientific context:
${contextText}

Instructions:
1. If the user asks why their footprint increased or changed, cite the EXACT numbers from their footprint data above (e.g. current ${userContext.weeklyTotalCO2} kg vs previous ${userContext.previousWeekTotalCO2} kg, highlighting that ${userContext.largestCategory} is the primary driver).
2. Answer warmly and encouragingly. NEVER shame or judge the user.
3. Ground all factual statements and recommendations STRICTLY in the retrieved context. Do not invent emission factors.
4. Reference the source names naturally (e.g. US EPA, UN ActNow, GHG Protocol).
5. Provide 2 to 3 practical, actionable recommendations tailored specifically to their largest contributor (${userContext.largestCategory}).
6. Return your response as a valid JSON object matching this structure:
{
  "answer": "<2-4 sentence personalized answer using their exact data>",
  "summary": "<1 brief sentence summary>",
  "recommendations": ["<Action 1>", "<Action 2>", "<Action 3>"],
  "reason": "<Why this matters based on the retrieved context and user footprint>"
}
Return ONLY valid JSON. No markdown backticks, no preamble.`

    let coachData: { answer: string; summary: string; recommendations: string[]; reason: string } | null = null

    // Provider 1: OpenRouter (Qwen3-32B or Qwen-2.5-72B)
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (openrouterKey && !openrouterKey.startsWith('your_')) {
      coachData = await this.callOpenRouter(prompt, openrouterKey)
    }

    // Provider 2: OpenAI Fallback
    if (!coachData) {
      const openaiKey = process.env.OPENAI_API_KEY
      if (openaiKey && !openaiKey.startsWith('your_')) {
        coachData = await this.callOpenAI(prompt, openaiKey)
      }
    }

    // Provider 3: Deterministic Grounded Template
    if (!coachData) {
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
   * Call OpenRouter with Qwen model family
   */
  private async callOpenRouter(
    prompt: string,
    apiKey: string
  ): Promise<{ answer: string; summary: string; recommendations: string[]; reason: string } | null> {
    const rawModel = process.env.OPENROUTER_MODEL || 'qwen/qwen3-32b'
    // Normalize model slug if :free was requested but paid slug is active
    const candidateModels = [
      rawModel,
      rawModel.replace(':free', ''),
      'qwen/qwen-2.5-72b-instruct',
    ]

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
                content: 'You are PlanetPulse AI Carbon Coach. Always respond in valid JSON format matching the requested schema. Do not enclose in markdown blocks.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        })

        if (!res.ok) {
          console.warn(`[OpenRouter] Model ${model} returned status ${res.status}`)
          continue
        }

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
          temperature: 0.3,
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
   * Deterministic grounded template when offline or without active LLM credentials
   */
  private generateGroundedTemplate(
    userContext: UserContext,
    searchResults: SearchResult[]
  ): { answer: string; summary: string; recommendations: string[]; reason: string } {
    const topResult = searchResults[0]
    const sourceName = topResult ? topResult.chunk.sourceName : 'UN ActNow'

    const trend =
      userContext.previousWeekTotalCO2 > 0
        ? ` (vs ${userContext.previousWeekTotalCO2} kg last week, ${userContext.weeklyDeltaCO2 > 0 ? `+${userContext.weeklyPercentChange}%` : `${userContext.weeklyPercentChange}%`})`
        : ''

    return {
      answer: `Your weekly carbon total is ${userContext.weeklyTotalCO2} kg CO₂${trend}, with ${userContext.largestCategory} representing your largest sector (${userContext.largestCategoryCO2} kg, ${userContext.largestCategoryPercent}%). According to ${sourceName}, targeted adjustments in your ${userContext.largestCategory.toLowerCase()} habits will have the highest immediate impact on lowering your footprint.`,
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
