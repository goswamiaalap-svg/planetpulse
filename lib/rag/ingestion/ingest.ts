import path from 'path'
import { loadAllKnowledgeDocs, chunkDocument } from './loader'
import { EmbeddingService } from '../embeddings/embeddingService'
import { getVectorStore } from '../services/carbonCoachService'

/**
 * CLI command to ingest all documents idempotently:
 * npm run ingest
 */
async function ingestAll() {
  console.log('🌱 [RAG Ingest] Loading knowledge documents...')
  const kbPath = path.join(process.cwd(), 'knowledge_base')
  const docs = loadAllKnowledgeDocs(kbPath)
  console.log(`Loaded ${docs.length} knowledge documents.`)

  const store = await getVectorStore()
  const embeddingService = new EmbeddingService()

  let totalChunks = 0
  for (const doc of docs) {
    const chunks = chunkDocument(doc)
    totalChunks += chunks.length
    for (const chunk of chunks) {
      chunk.embedding = await embeddingService.generateEmbedding(chunk.content)
    }
    await store.addDocuments(chunks)
  }

  console.log(`✅ [RAG Ingest] Successfully ingested ${totalChunks} chunks into VectorStore.`)
}

if (require.main === module) {
  ingestAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Ingestion failed:', err)
      process.exit(1)
    })
}

export { ingestAll }
