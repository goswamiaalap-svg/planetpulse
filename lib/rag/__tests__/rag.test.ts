import path from 'path'
import { loadAllKnowledgeDocs, chunkDocument } from '../ingestion/loader'
import { MemoryVectorStore } from '../vectorstore/vectorStore'
import { EmbeddingService } from '../embeddings/embeddingService'
import { buildUserContext } from '../context/userContext'
import { classifyQuery, rewriteQueryForRetrieval } from '../query/queryClassifier'
import { calculateWhatIf } from '../simulator/whatIfEngine'
import { CarbonCoachService } from '../services/carbonCoachService'
import { Activity } from '@/lib/supabase'

describe('RAG Knowledge Base & Carbon Coach System', () => {
  const kbPath = path.join(process.cwd(), 'knowledge_base')

  test('1. Document loader parses frontmatter and metadata', () => {
    const docs = loadAllKnowledgeDocs(kbPath)
    expect(docs.length).toBeGreaterThanOrEqual(4)

    const carDoc = docs.find((d) => d.subtopic === 'car')
    expect(carDoc).toBeDefined()
    expect(carDoc?.sourceName).toBe('US EPA')
    expect(carDoc?.sourceUrl).toContain('epa.gov')
  })

  test('2. Chunking preserves source metadata and produces non-empty chunks', () => {
    const docs = loadAllKnowledgeDocs(kbPath)
    const carDoc = docs.find((d) => d.subtopic === 'car')!
    const chunks = chunkDocument(carDoc, 400, 50)

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].sourceName).toBe('US EPA')
    expect(chunks[0].topic).toBe('transportation')
    expect(chunks[0].id).toContain('car_chunk_')
  })

  test('3. EmbeddingService produces valid unit vectors', async () => {
    const embeddingService = new EmbeddingService()
    const vec = await embeddingService.generateEmbedding('How to lower driving emissions?')
    expect(vec.length).toBe(1536)

    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    expect(norm).toBeCloseTo(1, 2)
  })

  test('4. Hybrid retrieval combines semantic and keyword matches with topic filtering', async () => {
    const store = new MemoryVectorStore()
    const embeddingService = new EmbeddingService()
    const docs = loadAllKnowledgeDocs(kbPath)

    for (const doc of docs) {
      const chunks = chunkDocument(doc)
      for (const chunk of chunks) {
        chunk.embedding = await embeddingService.generateEmbedding(chunk.content)
      }
      await store.addDocuments(chunks)
    }

    const query = 'carpooling and driving alternatives'
    const queryEmb = await embeddingService.generateEmbedding(query)
    const results = await store.hybridSearch(query, queryEmb, { topic: 'transportation', topK: 2 })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].chunk.topic).toBe('transportation')
  })

  test('5. Intent classifier correctly categorizes what-if, food, and energy', () => {
    expect(classifyQuery('What if I replace 2 car trips with public transport?').intent).toBe('what_if')
    expect(classifyQuery('How can I reduce my car footprint?').intent).toBe('transportation')
    expect(classifyQuery('Is eating vegetarian better for emissions?').intent).toBe('food')
    expect(classifyQuery('How to reduce home electricity?').intent).toBe('energy')
    expect(classifyQuery('What did I emit this week?').requiresRAG).toBe(false)
  })

  test('6. UserContextBuilder computes correct totals without PII', () => {
    const mockActivities: Activity[] = [
      { id: '1', type: 'car', quantity: 20, co2_kg: 4.0, date: '2026-09-15', created_at: '' },
      { id: '2', type: 'flight', quantity: 45, co2_kg: 11.25, date: '2026-09-15', created_at: '' },
    ]

    const ctx = buildUserContext(mockActivities, 10)
    expect(ctx.weeklyTotalCO2).toBe(15.25)
    expect(ctx.isOverTarget).toBe(true)
    expect(ctx.largestCategory).toBe('Flight')
    expect(ctx.targetExceededBy).toBe(5.3)
  })

  test('7. What-if engine computes strictly deterministic savings', () => {
    // 25km car (0.20 = 5kg) to bus (0.08 = 2kg) -> saves 3kg (60%)
    const sim = calculateWhatIf({ fromType: 'car', toType: 'bus', quantity: 25 })
    expect(sim.originalCO2).toBe(5)
    expect(sim.newCO2).toBe(2)
    expect(sim.savedCO2).toBe(3)
    expect(sim.percentageSaved).toBe(60)
  })

  test('8. CarbonCoachService returns structured, grounded responses with real citations', async () => {
    const coachService = new CarbonCoachService()
    const mockActivities: Activity[] = [
      { id: '1', type: 'car', quantity: 20, co2_kg: 4.0, date: '2026-09-15', created_at: '' },
    ]
    const ctx = buildUserContext(mockActivities, 30)

    const response = await coachService.consultCoach('How do I reduce my driving emissions?', ctx)

    expect(response.grounded).toBe(true)
    expect(response.recommendations.length).toBeGreaterThanOrEqual(2)
    expect(response.sources.length).toBeGreaterThan(0)
    expect(response.sources[0].url).toContain('http')
  })
})
