import { createClient } from '@/lib/supabase/client'
import type { Memory, Collection, UserProfile } from '@/components/aether/types'
import {
  cacheMemories,
  cacheMemory,
  getCachedMemories,
  deleteCachedMemory,
  updateCachedMemory,
  cacheCollections,
  getCachedCollections,
  addToSyncQueue,
  getSyncQueueCount,
} from '@/lib/offline-db'
import { getIsOnline } from '@/hooks/use-online-status'

const PAGE_SIZE = 20

// ─── AUTH ───

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

// ─── PROFILES ───

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name || '',
    email: data.email || '',
    initials: getInitials(data.name || data.email || ''),
    avatarUrl: data.avatar_url,
    plan: data.plan || 'free',
  }
}

export async function updateProfile(userId: string, updates: { name?: string; avatar_url?: string }) {
  if (!getIsOnline()) {
    // Queue for later sync
    await addToSyncQueue({
      type: 'update',
      entityType: 'memory',
      data: { id: userId, ...updates, entityType: 'profile' },
      createdAt: new Date().toISOString(),
    })
    return
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) throw error
}

// ─── MEMORIES ───

export async function fetchMemories(page: number = 0): Promise<{ memories: Memory[]; hasMore: boolean }> {
  // If offline, return cached memories
  if (!getIsOnline()) {
    const cached = await getCachedMemories()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE
    return {
      memories: cached.slice(from, to),
      hasMore: to < cached.length,
    }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Not authenticated — return cached memories from IndexedDB
    const cached = await getCachedMemories()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE
    return {
      memories: cached.slice(from, to),
      hasMore: to < cached.length,
    }
  }

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Fetch memories error:', error)
    // Fall back to cache
    const cached = await getCachedMemories()
    return { memories: cached.slice(from, to), hasMore: to < cached.length }
  }

  const memories: Memory[] = (data || []).map(mapMemoryFromDb)
  const hasMore = data?.length === PAGE_SIZE

  // Cache the fresh data
  if (page === 0 && memories.length > 0) {
    cacheMemories(memories).catch(() => {})
  } else {
    // Append individual memories to cache
    for (const m of memories) {
      cacheMemory(m).catch(() => {})
    }
  }

  return { memories, hasMore }
}

export async function createMemory(memory: {
  type: string
  title: string
  content: string
  summary?: string
  tags: string[]
  sourceUrl?: string
  fileUrl?: string
  imagePreview?: string
  collectionId?: string
}): Promise<Memory> {
  // If offline, save locally and queue for sync
  if (!getIsOnline()) {
    const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const offlineMemory: Memory = {
      id: tempId,
      type: memory.type as Memory['type'],
      title: memory.title,
      content: memory.content,
      tags: memory.tags,
      createdAt: new Date().toISOString(),
      summary: memory.summary,
      sourceUrl: memory.sourceUrl,
      fileUrl: memory.fileUrl,
      imagePreview: memory.imagePreview,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }

    // Cache locally
    await cacheMemory(offlineMemory)

    // Queue for sync
    await addToSyncQueue({
      type: 'create',
      entityType: 'memory',
      data: { ...memory, tempId },
      tempId,
      createdAt: new Date().toISOString(),
    })

    return offlineMemory
  }

  // ─── Try authenticated Supabase save; fall back to local on any error ───
  // This ensures memories are NEVER lost even if the session expires,
  // Supabase is unreachable, or getUser() throws.
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Not authenticated — fall back to local-only save
      return saveMemoryLocally(memory)
    }

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        tags: memory.tags,
        source_url: memory.sourceUrl,
        file_url: memory.fileUrl,
        image_preview: memory.imagePreview,
      })
      .select()
      .single()

    if (error) throw error

    // Add to collection if specified
    if (memory.collectionId && data) {
      await supabase.from('memory_collections').insert({
        memory_id: data.id,
        collection_id: memory.collectionId,
      })
    }

    const savedMemory = mapMemoryFromDb(data)

    // Cache the saved memory
    await cacheMemory(savedMemory)

    // Fire-and-forget: generate and store embedding for semantic search
    // This never blocks the memory save and fails silently
    storeEmbeddingFireAndForget(savedMemory.id, {
      title: memory.title,
      content: memory.content,
      tags: memory.tags,
      aiSummary: memory.summary,
    }).catch(() => {})

    return savedMemory
  } catch (err) {
    // Supabase save failed (expired session, network error, etc.)
    // Fall back to local-only save so the memory is never lost.
    console.warn('[Aether] Supabase save failed, saving locally:', err)
    return saveMemoryLocally(memory)
  }
}

export async function updateMemoryById(id: string, updates: { content?: string; tags?: string[]; title?: string; summary?: string; imagePreview?: string }) {
  const dbUpdates: Record<string, any> = {}
  if (updates.content !== undefined) dbUpdates.content = updates.content
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.summary !== undefined) dbUpdates.summary = updates.summary
  if (updates.imagePreview !== undefined) dbUpdates.image_preview = updates.imagePreview

  if (Object.keys(dbUpdates).length === 0) return

  // Update local cache immediately
  await updateCachedMemory(id, { ...updates, updatedAt: new Date().toISOString() })

  if (!getIsOnline()) {
    // Queue for sync later
    await addToSyncQueue({
      type: 'update',
      entityType: 'memory',
      data: { id, ...dbUpdates, updatedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    })
    return
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('memories')
    .update(dbUpdates)
    .eq('id', id)

  if (error) throw error

  // Fire-and-forget: regenerate embedding if content/tags/title changed
  if (updates.content || updates.tags || updates.title) {
    // We need to get the full memory to build the embedding text
    // But since this is fire-and-forget, we can fetch it asynchronously
    regenerateEmbeddingFireAndForget(id).catch(() => {})
  }
}

/**
 * Regenerate the embedding for a memory after it's been updated.
 * Fetches the current memory data, builds embedding text, and stores it.
 */
async function regenerateEmbeddingFireAndForget(memoryId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('memories')
      .select('title, content, tags, summary')
      .eq('id', memoryId)
      .single()

    if (!data) return

    const { generateEmbedding, buildMemoryEmbeddingText, isZeroVector } = await import('@/lib/embeddings')

    const textToEmbed = buildMemoryEmbeddingText({
      title: data.title || '',
      content: data.content || '',
      tags: data.tags || [],
      aiSummary: data.summary || undefined,
    })
    const embedding = await generateEmbedding(textToEmbed)

    if (isZeroVector(embedding)) return

    const { error } = await supabase.rpc('update_memory_embedding', {
      memory_id: memoryId,
      new_embedding: embedding,
    })

    if (error) {
      console.warn('[Aether] Failed to update embedding:', error.message)
    }
  } catch (error) {
    console.warn('[Aether] Embedding regeneration failed:', error)
  }
}

export async function deleteMemoryById(id: string) {
  // Delete from local cache immediately
  await deleteCachedMemory(id)

  if (!getIsOnline()) {
    // Queue for sync later
    await addToSyncQueue({
      type: 'delete',
      entityType: 'memory',
      data: { id },
      createdAt: new Date().toISOString(),
    })
    return
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getMemoryCount(): Promise<number> {
  if (!getIsOnline()) {
    // Return cached count
    const cached = await getCachedMemories()
    return cached.length
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('memories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (error) return 0
  return count || 0
}

// ─── COLLECTIONS ───

export async function fetchCollections(): Promise<Collection[]> {
  if (!getIsOnline()) {
    return getCachedCollections()
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Fetch collections error:', error)
    return getCachedCollections()
  }

  // Get memory counts for each collection
  const collections: Collection[] = []
  for (const col of (data || [])) {
    const { count } = await supabase
      .from('memory_collections')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', col.id)

    collections.push({
      id: col.id,
      name: col.name,
      icon: col.icon,
      color: col.color,
      memoryCount: count || 0,
      lastUpdated: col.created_at,
      userId: col.user_id,
    })
  }

  // Cache the collections
  await cacheCollections(collections).catch(() => {})

  return collections
}

export async function createCollection(collection: {
  name: string
  icon: string
  color: string
}): Promise<Collection> {
  if (!getIsOnline()) {
    const tempId = `offline-col-${Date.now()}`
    const offlineCollection: Collection = {
      id: tempId,
      name: collection.name,
      icon: collection.icon,
      color: collection.color,
      memoryCount: 0,
      lastUpdated: new Date().toISOString().split('T')[0],
    }
    await cacheCollections([...(await getCachedCollections()), offlineCollection])
    await addToSyncQueue({
      type: 'create',
      entityType: 'collection',
      data: { ...collection, tempId },
      tempId,
      createdAt: new Date().toISOString(),
    })
    return offlineCollection
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('collections')
    .insert({
      user_id: user.id,
      name: collection.name,
      icon: collection.icon,
      color: collection.color,
    })
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    icon: data.icon,
    color: data.color,
    memoryCount: 0,
    lastUpdated: data.created_at,
    userId: data.user_id,
  }
}

export async function addMemoryToCollection(memoryId: string, collectionId: string) {
  if (!getIsOnline()) {
    // Queue for later
    await addToSyncQueue({
      type: 'update',
      entityType: 'memory',
      data: { id: memoryId, collectionId, _op: 'addToCollection' },
      createdAt: new Date().toISOString(),
    })
    return
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('memory_collections')
    .insert({ memory_id: memoryId, collection_id: collectionId })

  if (error) throw error
}

export async function getMemoriesForCollection(collectionId: string): Promise<Memory[]> {
  if (!getIsOnline()) {
    const cached = await getCachedMemories()
    // Can't filter by collection in offline mode without the junction table cached
    // Return all cached memories — the UI will handle it
    return cached
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('memory_collections')
    .select('memory_id, memories(*)')
    .eq('collection_id', collectionId)

  if (error || !data) return []

  return data
    .map((row: any) => row.memories ? mapMemoryFromDb(row.memories) : null)
    .filter(Boolean) as Memory[]
}

// ─── EXPORT ───

export async function exportAllMemories(): Promise<string> {
  if (!getIsOnline()) {
    // Export from cache
    const cached = await getCachedMemories()
    return JSON.stringify(cached, null, 2)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  return JSON.stringify(data, null, 2)
}

// ─── HELPERS ───

/**
 * Save a memory locally (IndexedDB + sync queue) when Supabase is unavailable
 * or the user is not authenticated. Returns a Memory object with a `local-` prefix ID
 * and `syncStatus: 'pending'` so it can be synced later.
 */
async function saveMemoryLocally(memory: {
  type: string
  title: string
  content: string
  summary?: string
  tags: string[]
  sourceUrl?: string
  fileUrl?: string
  imagePreview?: string
}): Promise<Memory> {
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const localMemory: Memory = {
    id: localId,
    type: memory.type as Memory['type'],
    title: memory.title,
    content: memory.content,
    tags: memory.tags,
    createdAt: new Date().toISOString(),
    summary: memory.summary,
    sourceUrl: memory.sourceUrl,
    fileUrl: memory.fileUrl,
    imagePreview: memory.imagePreview,
    syncStatus: 'pending',
    updatedAt: new Date().toISOString(),
  }

  // Cache locally via IndexedDB
  await cacheMemory(localMemory)

  // Queue for sync (when they log in later, it'll sync)
  await addToSyncQueue({
    type: 'create',
    entityType: 'memory',
    data: { ...memory, tempId: localId },
    tempId: localId,
    createdAt: new Date().toISOString(),
  })

  return localMemory
}

function mapMemoryFromDb(row: any): Memory {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    tags: row.tags || [],
    createdAt: row.created_at,
    source: row.source_url,
    aiSummary: row.summary,
    summary: row.summary,
    sourceUrl: row.source_url,
    fileUrl: row.file_url,
    imagePreview: row.image_preview,
    userId: row.user_id,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  }
}

function getInitials(name: string): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─── Offline helpers ───

export async function getOfflineMemoryCount(): Promise<number> {
  return (await getCachedMemories()).length
}

export async function getOfflineSyncQueueCount(): Promise<number> {
  return getSyncQueueCount()
}

// ─── Embeddings / Semantic Search ───

/**
 * Fire-and-forget: generate an embedding for a memory and store it in Supabase.
 * This is called after a memory is created and should NEVER block the save flow.
 * If the embedding fails, the memory is still saved — it just won't be in semantic search
 * until a backfill is run.
 */
async function storeEmbeddingFireAndForget(
  memoryId: string,
  memoryData: { title: string; content: string; tags: string[]; aiSummary?: string }
): Promise<void> {
  try {
    const { generateEmbedding, buildMemoryEmbeddingText, isZeroVector } = await import('@/lib/embeddings')

    const textToEmbed = buildMemoryEmbeddingText(memoryData)
    const embedding = await generateEmbedding(textToEmbed)

    // Don't store zero vectors (means generation failed)
    if (isZeroVector(embedding)) return

    const supabase = createClient()

    // Use the service role approach — call the update_memory_embedding function
    // which runs as SECURITY DEFINER
    const { error } = await supabase.rpc('update_memory_embedding', {
      memory_id: memoryId,
      new_embedding: embedding,
    })

    if (error) {
      console.warn('[Aether] Failed to store embedding:', error.message)
    }
  } catch (error) {
    // Silently fail — embeddings are non-critical
    console.warn('[Aether] Embedding storage failed:', error)
  }
}

/**
 * Semantic search: find memories similar to a query using pgvector.
 * Falls back to empty array if embeddings are not available.
 * This is called from the server-side AI ask route.
 */
export async function semanticSearchMemories(
  userId: string,
  queryEmbedding: number[],
  matchCount: number = 10,
  matchThreshold: number = 0.3
): Promise<Memory[]> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: queryEmbedding,
      matching_user_id: userId,
      match_count: matchCount,
      match_threshold: matchThreshold,
    })

    if (error) {
      console.warn('[Aether] Semantic search RPC failed:', error.message)
      return []
    }

    if (!data || !Array.isArray(data)) return []

    return data.map((row: any) => mapMemoryFromDb(row))
  } catch (error) {
    console.warn('[Aether] Semantic search failed:', error)
    return []
  }
}
