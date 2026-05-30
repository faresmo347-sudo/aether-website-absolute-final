/**
 * Aether Embeddings — Semantic search using Hugging Face Inference API
 *
 * Uses sentence-transformers/all-MiniLM-L6-v2 (free, 384-dim vectors)
 * to generate embeddings for memories and search queries.
 *
 * The HF Inference API is free for small-scale usage and requires
 * an HF_API_TOKEN (get one at https://huggingface.co/settings/tokens).
 */

const HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction'
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const EMBEDDING_DIMENSION = 384

// Simple in-memory cache for recent embeddings (query → vector)
// Prevents redundant API calls for repeated queries
const embeddingCache = new Map<string, number[]>()
const MAX_CACHE_SIZE = 100

/**
 * Generate a 384-dimensional embedding vector for the given text.
 * Uses Hugging Face's free Inference API with sentence-transformers/all-MiniLM-L6-v2.
 *
 * @param text - The text to embed (title + content + tags + summary for memories, or the question for queries)
 * @returns A float array of length 384
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) {
    // Return zero vector for empty text
    return new Array(EMBEDDING_DIMENSION).fill(0)
  }

  // Check cache first
  const cacheKey = trimmed.slice(0, 200) // Use first 200 chars as key
  const cached = embeddingCache.get(cacheKey)
  if (cached) return cached

  const hfToken = process.env.HF_API_TOKEN
  if (!hfToken) {
    // No token → return zero vector (semantic search gracefully disabled)
    console.warn('[Aether] HF_API_TOKEN not set — semantic search disabled. Set it in .env.local to enable.')
    return new Array(EMBEDDING_DIMENSION).fill(0)
  }

  try {
    const response = await fetch(`${HF_API_URL}/${EMBEDDING_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: trimmed.slice(0, 2000), // Limit input length to avoid token limits
        options: {
          wait_for_model: true, // Wait if model is loading
          use_cache: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      console.error(`[Aether] Embedding API error (${response.status}): ${errorText}`)
      return new Array(EMBEDDING_DIMENSION).fill(0)
    }

    const data = await response.json()

    // HF feature-extraction returns a nested array: [[[[0.1, 0.2, ...]]]]
    // We need to flatten and take the first (and only) embedding
    let embedding: number[]

    if (Array.isArray(data)) {
      // Flatten nested arrays to get the final vector
      const flat = flattenDeep(data)
      if (flat.length === EMBEDDING_DIMENSION) {
        embedding = flat as number[]
      } else if (flat.length > EMBEDDING_DIMENSION) {
        // Sometimes returns token-level embeddings; average them
        // Reshape: if we have N tokens each with 384 dims
        const numTokens = Math.floor(flat.length / EMBEDDING_DIMENSION)
        embedding = new Array(EMBEDDING_DIMENSION).fill(0)
        for (let t = 0; t < numTokens; t++) {
          for (let d = 0; d < EMBEDDING_DIMENSION; d++) {
            embedding[d] += flat[t * EMBEDDING_DIMENSION + d]
          }
        }
        // Average
        for (let d = 0; d < EMBEDDING_DIMENSION; d++) {
          embedding[d] /= numTokens
        }
      } else {
        // Unexpected dimension — pad with zeros
        console.warn(`[Aether] Unexpected embedding dimension: ${flat.length}, expected ${EMBEDDING_DIMENSION}`)
        embedding = [...flat, ...new Array(EMBEDDING_DIMENSION - flat.length).fill(0)] as number[]
      }
    } else {
      console.error('[Aether] Unexpected embedding response format:', typeof data)
      return new Array(EMBEDDING_DIMENSION).fill(0)
    }

    // Cache the result
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      // Evict oldest entry
      const firstKey = embeddingCache.keys().next().value
      if (firstKey) embeddingCache.delete(firstKey)
    }
    embeddingCache.set(cacheKey, embedding)

    return embedding
  } catch (error) {
    console.error('[Aether] Embedding generation failed:', error)
    return new Array(EMBEDDING_DIMENSION).fill(0)
  }
}

/**
 * Build the text to embed for a memory.
 * Combines title, content, tags, and AI summary for maximum searchability.
 */
export function buildMemoryEmbeddingText(memory: {
  title: string
  content: string
  tags: string[]
  aiSummary?: string
}): string {
  const parts: string[] = []

  if (memory.title) parts.push(memory.title)
  if (memory.content) parts.push(memory.content)
  if (memory.tags && memory.tags.length > 0) parts.push(memory.tags.join(' '))
  if (memory.aiSummary) parts.push(memory.aiSummary)

  return parts.join(' | ')
}

/**
 * Check if the embedding is a zero vector (meaning generation failed or is disabled).
 */
export function isZeroVector(embedding: number[]): boolean {
  return embedding.every((v) => v === 0)
}

/**
 * Deep flatten a nested array into a single-level array of numbers.
 */
function flattenDeep(arr: unknown[]): number[] {
  const result: number[] = []
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item))
    } else if (typeof item === 'number') {
      result.push(item)
    }
  }
  return result
}
