/**
 * lib/rag/eval/retrieverEvaluator.ts
 * Dedicated Retriever Evaluation Suite for evaluating Recall@K, Precision@K, HitRate, MRR, and Latency
 */

import { getVectorStore } from '../services/carbonCoachService'
import { EmbeddingService } from '../embeddings/embeddingService'
import { GOLDEN_DATASET, GoldenTestCase } from './goldenDataset'

export interface KMetrics {
  k: number
  recall: number
  precision: number
  hitRate: number
  mrr: number
  avgScore: number
}

export interface RetrieverEvalReport {
  timestamp: string
  totalInDomainQueries: number
  metricsByK: Record<number, KMetrics>
  bestK: number
  p50LatencyMs: number
  p95LatencyMs: number
  avgLatencyMs: number
  categoryPerformance: Record<string, { hitRate: number; avgTopScore: number }>
}

export async function evaluateRetriever(
  kValues: number[] = [1, 3, 5, 8, 10]
): Promise<RetrieverEvalReport> {
  const vectorStore = await getVectorStore()
  const embeddingService = new EmbeddingService()

  // Filter in-domain and paraphrase questions that expect document evidence
  const testCases = GOLDEN_DATASET.filter(
    (tc) => (tc.category === 'in_domain' || tc.category === 'paraphrase' || tc.category === 'difficult_ambiguous') &&
            tc.expectedEvidenceKeywords &&
            tc.expectedEvidenceKeywords.length > 0
  )

  const latencies: number[] = []
  const kResults: Record<number, { hits: number; totalExpected: number; retrievedRelevant: number; totalRetrieved: number; rrSum: number; scoreSum: number }> = {}

  kValues.forEach((k) => {
    kResults[k] = {
      hits: 0,
      totalExpected: 0,
      retrievedRelevant: 0,
      totalRetrieved: 0,
      rrSum: 0,
      scoreSum: 0,
    }
  })

  const categoryMap: Record<string, { hits: number; count: number; scoreSum: number }> = {}

  for (const testCase of testCases) {
    const start = Date.now()
    const queryEmb = await embeddingService.generateEmbedding(testCase.query)
    const allResults = await vectorStore.hybridSearch(testCase.query, queryEmb, {
      topK: Math.max(...kValues),
      threshold: 0.2,
    })
    const lat = Date.now() - start
    latencies.push(lat)

    const expectedKeywords = testCase.expectedEvidenceKeywords || []
    const cat = testCase.expectedTopic || 'general'
    if (!categoryMap[cat]) categoryMap[cat] = { hits: 0, count: 0, scoreSum: 0 }
    categoryMap[cat].count++
    if (allResults.length > 0) categoryMap[cat].scoreSum += allResults[0].score

    // Evaluate for each K
    kValues.forEach((k) => {
      const topKResults = allResults.slice(0, k)
      kResults[k].totalExpected += expectedKeywords.length
      kResults[k].totalRetrieved += topKResults.length

      let isHit = false
      let firstRank = -1

      topKResults.forEach((res, rank) => {
        const text = res.chunk.content.toLowerCase()
        const matchesTopic = !testCase.expectedTopic || res.chunk.topic.toLowerCase() === testCase.expectedTopic.toLowerCase()
        const matchesSubtopic = !testCase.expectedSubtopic || res.chunk.subtopic.toLowerCase() === testCase.expectedSubtopic.toLowerCase()
        const matchedKw = expectedKeywords.filter((kw) => text.includes(kw.toLowerCase())).length

        const isRelevant = (matchesTopic && matchesSubtopic) || matchedKw >= 1

        if (isRelevant) {
          kResults[k].retrievedRelevant++
          if (!isHit) {
            isHit = true
            firstRank = rank + 1
          }
        }
      })

      if (isHit) {
        kResults[k].hits++
        kResults[k].rrSum += 1 / firstRank
      }

      if (topKResults.length > 0) {
        kResults[k].scoreSum += topKResults[0].score
      }
    })

    if (allResults.length > 0 && expectedKeywords.some((kw) => allResults[0].chunk.content.toLowerCase().includes(kw.toLowerCase()))) {
      categoryMap[cat].hits++
    }
  }

  // Compute metrics per K
  const metricsByK: Record<number, KMetrics> = {}
  let bestK = kValues[0]
  let bestScore = -1

  kValues.forEach((k) => {
    const res = kResults[k]
    const hitRate = res.hits / testCases.length
    const precision = res.totalRetrieved > 0 ? res.retrievedRelevant / res.totalRetrieved : 0
    const recall = res.totalExpected > 0 ? res.retrievedRelevant / res.totalExpected : 0
    const mrr = res.rrSum / testCases.length
    const avgScore = res.scoreSum / testCases.length

    metricsByK[k] = {
      k,
      hitRate: +hitRate.toFixed(3),
      precision: +precision.toFixed(3),
      recall: +recall.toFixed(3),
      mrr: +mrr.toFixed(3),
      avgScore: +avgScore.toFixed(3),
    }

    // Balance HitRate and context noise
    const scoreMetric = hitRate * 0.7 + precision * 0.3
    if (scoreMetric > bestScore) {
      bestScore = scoreMetric
      bestK = k
    }
  })

  // Calculate latency percentiles
  latencies.sort((a, b) => a - b)
  const p50LatencyMs = latencies[Math.floor(latencies.length * 0.5)] || 0
  const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0
  const avgLatencyMs = +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)

  const categoryPerformance: Record<string, { hitRate: number; avgTopScore: number }> = {}
  for (const [cat, data] of Object.entries(categoryMap)) {
    categoryPerformance[cat] = {
      hitRate: +(data.hits / data.count).toFixed(3),
      avgTopScore: +(data.scoreSum / data.count).toFixed(3),
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalInDomainQueries: testCases.length,
    metricsByK,
    bestK,
    p50LatencyMs,
    p95LatencyMs,
    avgLatencyMs,
    categoryPerformance,
  }
}
