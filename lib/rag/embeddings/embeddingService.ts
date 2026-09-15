/**
 * Embedding Service supporting OpenAI text-embedding-3-small and local fallback
 */
export class EmbeddingService {
  private apiKey: string | null
  private model: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || null
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
  }

  /**
   * Generates a vector embedding for a single text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey || this.apiKey.startsWith('your_')) {
      // Deterministic pseudo-embedding for testing when OpenAI API key is not present
      return this.generateDeterministicEmbedding(text, 1536)
    }

    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.replace(/\n/g, ' '),
        }),
      })

      if (!res.ok) {
        throw new Error(`OpenAI embedding failed: ${res.statusText}`)
      }

      const data = await res.json()
      return data.data[0].embedding
    } catch (err) {
      console.warn('[EmbeddingService] Falling back to deterministic embedding:', err)
      return this.generateDeterministicEmbedding(text, 1536)
    }
  }

  /**
   * Batch generation of embeddings
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = []
    for (const text of texts) {
      results.push(await this.generateEmbedding(text))
    }
    return results
  }

  /**
   * Fallback deterministic pseudo-embedding to allow offline/local unit tests and zero-dependency operation
   */
  private generateDeterministicEmbedding(text: string, dimensions = 1536): number[] {
    const embedding: number[] = new Array(dimensions).fill(0)
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i)
      hash |= 0
    }

    for (let i = 0; i < dimensions; i++) {
      const seed = Math.sin(hash + i * 31)
      embedding[i] = Math.round(seed * 10000) / 10000
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1
    return embedding.map((v) => v / magnitude)
  }
}
