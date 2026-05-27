// In-memory cache for AI tag results
// Avoids re-calling the LLM for duplicate content

const cache = new Map<string, string[]>()
const MAX_CACHE_SIZE = 200

function hashContent(content: string, type: string): string {
  // Simple hash — use type + first 200 chars normalized
  return `${type}:${content.slice(0, 200).toLowerCase().trim()}`
}

export function getCachedTags(content: string, type: string): string[] | null {
  return cache.get(hashContent(content, type)) || null
}

export function setCachedTags(content: string, type: string, tags: string[]): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Delete oldest entry (first key inserted)
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(hashContent(content, type), tags)
}

export function clearTagCache(): void {
  cache.clear()
}

export function getCacheSize(): number {
  return cache.size
}
