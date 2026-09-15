import fs from 'fs'
import path from 'path'

export interface KnowledgeDocument {
  id: string
  content: string
  topic: string
  subtopic: string
  sourceName: string
  sourceTitle: string
  sourceUrl: string
}

export interface KnowledgeChunk extends KnowledgeDocument {
  chunkIndex: number
  embedding?: number[]
}

/**
 * Parses markdown frontmatter and content
 */
export function parseMarkdownDoc(filePath: string): KnowledgeDocument {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const frontmatterRegex = /^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/
  const match = fileContent.match(frontmatterRegex)

  let topic = 'general'
  let subtopic = 'general'
  let sourceName = 'Environmental Reference'
  let sourceTitle = 'Climate Science Documentation'
  let sourceUrl = 'https://www.un.org/en/actnow'
  let body = fileContent

  if (match) {
    const rawFm = match[1]
    body = match[2].trim()

    rawFm.split('\n').forEach((line) => {
      const [key, ...rest] = line.split(':')
      if (key && rest.length > 0) {
        const val = rest.join(':').trim()
        if (key.trim() === 'topic') topic = val
        if (key.trim() === 'subtopic') subtopic = val
        if (key.trim() === 'source_name') sourceName = val
        if (key.trim() === 'source_title') sourceTitle = val
        if (key.trim() === 'source_url') sourceUrl = val
      }
    })
  }

  const id = path.basename(filePath, '.md')

  return {
    id,
    content: body,
    topic,
    subtopic,
    sourceName,
    sourceTitle,
    sourceUrl,
  }
}

/**
 * Load all knowledge documents from knowledge_base directory
 */
export function loadAllKnowledgeDocs(baseDir: string): KnowledgeDocument[] {
  const docs: KnowledgeDocument[] = []

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith('.md')) {
        docs.push(parseMarkdownDoc(fullPath))
      }
    }
  }

  walk(baseDir)
  return docs
}

/**
 * Splits document content into chunks with overlap
 */
export function chunkDocument(
  doc: KnowledgeDocument,
  maxChunkSize = 600,
  overlap = 80
): KnowledgeChunk[] {
  const paragraphs = doc.content.split(/\n\s*\n/)
  const chunks: KnowledgeChunk[] = []

  let currentChunk = ''
  let chunkIdx = 0

  for (const p of paragraphs) {
    const cleanP = p.trim()
    if (!cleanP) continue

    if (currentChunk.length + cleanP.length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanP
    } else {
      if (currentChunk) {
        chunks.push({
          ...doc,
          id: `${doc.id}_chunk_${chunkIdx}`,
          chunkIndex: chunkIdx++,
          content: currentChunk,
        })
      }
      // Start next chunk with trailing overlap from previous chunk if possible
      const overlapText = currentChunk.slice(-overlap)
      currentChunk = (overlapText ? overlapText + '\n\n' : '') + cleanP
    }
  }

  if (currentChunk) {
    chunks.push({
      ...doc,
      id: `${doc.id}_chunk_${chunkIdx}`,
      chunkIndex: chunkIdx,
      content: currentChunk,
    })
  }

  return chunks
}
