import { KnowledgeChunk } from '../ingestion/loader'

export interface SearchOptions {
  topK?: number
  topic?: string
  subtopic?: string
  threshold?: number
}

export interface SearchResult {
  chunk: KnowledgeChunk
  score: number
}

export interface VectorStore {
  addDocuments(chunks: KnowledgeChunk[]): Promise<void>
  similaritySearch(queryEmbedding: number[], options?: SearchOptions): Promise<SearchResult[]>
  keywordSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>
  hybridSearch(query: string, queryEmbedding: number[], options?: SearchOptions): Promise<SearchResult[]>
  deleteDocuments(ids: string[]): Promise<void>
}

/**
 * In-Memory & Supabase-compatible VectorStore implementation
 */
export class MemoryVectorStore implements VectorStore {
  private chunks: KnowledgeChunk[] = []

  async addDocuments(chunks: KnowledgeChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const idx = this.chunks.findIndex((c) => c.id === chunk.id)
      if (idx >= 0) {
        this.chunks[idx] = chunk // Update existing (idempotent)
      } else {
        this.chunks.push(chunk)
      }
    }
  }

  async similaritySearch(queryEmbedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const topK = options.topK ?? 4
    const threshold = options.threshold ?? 0.2

    let candidates = this.chunks

    // Apply metadata filtering if specified
    if (options.topic) {
      candidates = candidates.filter((c) => c.topic.toLowerCase() === options.topic?.toLowerCase())
    }
    if (options.subtopic) {
      candidates = candidates.filter((c) => c.subtopic.toLowerCase() === options.subtopic?.toLowerCase())
    }

    const scored: SearchResult[] = []

    for (const chunk of candidates) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue
      const score = cosineSimilarity(queryEmbedding, chunk.embedding)
      if (score >= threshold) {
        scored.push({ chunk, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async keywordSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const topK = options.topK ?? 4
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)

    let candidates = this.chunks
    if (options.topic) {
      candidates = candidates.filter((c) => c.topic.toLowerCase() === options.topic?.toLowerCase())
    }

    const scored: SearchResult[] = []

    for (const chunk of candidates) {
      const text = chunk.content.toLowerCase()
      let matches = 0
      for (const term of terms) {
        if (text.includes(term)) matches++
      }

      if (matches > 0) {
        const score = matches / terms.length
        scored.push({ chunk, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async hybridSearch(query: string, queryEmbedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const topK = options.topK ?? 4
    const [vectorResults, keywordResults] = await Promise.all([
      this.similaritySearch(queryEmbedding, { ...options, topK: topK * 2 }),
      this.keywordSearch(query, { ...options, topK: topK * 2 }),
    ])

    // Merge and rank via Reciprocal Rank Fusion (RRF)
    const scoreMap = new Map<string, { chunk: KnowledgeChunk; score: number }>()

    const k = 60
    vectorResults.forEach((res, rank) => {
      const rrf = 1 / (k + rank + 1)
      scoreMap.set(res.chunk.id, { chunk: res.chunk, score: rrf * 0.7 })
    })

    keywordResults.forEach((res, rank) => {
      const rrf = 1 / (k + rank + 1)
      const existing = scoreMap.get(res.chunk.id)
      if (existing) {
        existing.score += rrf * 0.3
      } else {
        scoreMap.set(res.chunk.id, { chunk: res.chunk, score: rrf * 0.3 })
      }
    })

    const combined = Array.from(scoreMap.values())
    combined.sort((a, b) => b.score - a.score)
    return combined.slice(0, topK)
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    const set = new Set(ids)
    this.chunks = this.chunks.filter((c) => !set.has(c.id))
  }

  getAllChunks(): KnowledgeChunk[] {
    return this.chunks
  }
}

/**
 * Computes standard cosine similarity between two unit vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
