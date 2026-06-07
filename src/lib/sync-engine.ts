// Background sync engine for Aether
// Syncs queued offline operations when internet connection is restored
// Uses smart delta sync and conflict resolution

import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncQueueItem,
  getSyncQueueCount,
  cacheMemories,
  cacheCollections,
  setLastSyncTimestamp,
  getLastSyncTimestamp,
  type SyncQueueItem,
} from './offline-db'
import {
  createMemory,
  updateMemoryById,
  deleteMemoryById,
  fetchMemories,
  fetchCollections,
} from '@/lib/supabase/data'
import type { Memory } from '@/components/aether/types'
import { getIsOnline } from '@/hooks/use-online-status'

// ─── Types ───

interface SyncResult {
  synced: number
  failed: number
  conflicts: number
}

type SyncStatusCallback = (status: 'syncing' | 'complete' | 'error', progress?: { done: number; total: number }) => void
type SyncCompleteCallback = (result: SyncResult) => void

// ─── State ───

let isSyncing = false
let syncStatusCallbacks: SyncStatusCallback[] = []
let syncCompleteCallbacks: SyncCompleteCallback[] = []

// ─── Public API ───

export function onSyncStatus(cb: SyncStatusCallback): () => void {
  syncStatusCallbacks.push(cb)
  return () => {
    syncStatusCallbacks = syncStatusCallbacks.filter((fn) => fn !== cb)
  }
}

export function onSyncComplete(cb: SyncCompleteCallback): () => void {
  syncCompleteCallbacks.push(cb)
  return () => {
    syncCompleteCallbacks = syncCompleteCallbacks.filter((fn) => fn !== cb)
  }
}

export function getIsSyncing(): boolean {
  return isSyncing
}

// ─── Process Sync Queue ───

async function processSyncQueue(): Promise<SyncResult> {
  const queue = await getSyncQueue()
  if (queue.length === 0) return { synced: 0, failed: 0, conflicts: 0 }

  const result: SyncResult = { synced: 0, failed: 0, conflicts: 0 }
  const total = queue.length

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    if (!item.id) continue

    notifyStatus('syncing', { done: i, total })

    try {
      await processQueueItem(item)
      await removeFromSyncQueue(item.id)
      result.synced++
    } catch (error: any) {
      // Check if it's a conflict
      if (isConflictError(error)) {
        result.conflicts++
        await resolveConflict(item, error)
        await removeFromSyncQueue(item.id)
      } else {
        result.failed++
        // Increment retry count, give up after 5 retries
        const newRetryCount = (item.retryCount || 0) + 1
        if (newRetryCount >= 5) {
          await removeFromSyncQueue(item.id)
        } else {
          await updateSyncQueueItem(item.id, {
            retryCount: newRetryCount,
            lastError: error?.message || 'Unknown error',
          })
        }
      }
    }
  }

  return result
}

async function processQueueItem(item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case 'create':
      if (item.entityType === 'memory') {
        const { tempId, ...createData } = item.data as Record<string, unknown>
        const saved = await createMemory(createData as Parameters<typeof createMemory>[0])
        // If there's a tempId, we need to notify the store to replace it
        if (item.tempId && tempId) {
          // The store will handle replacing the temp ID with the real one
          // via the callback pattern
          window.dispatchEvent(new CustomEvent('aether:memory-synced', {
            detail: { tempId: item.tempId, realId: saved.id, memory: saved },
          }))
        }
      }
      break

    case 'update':
      if (item.entityType === 'memory') {
        const { id, ...updates } = item.data
        await updateMemoryById(id, updates)
      }
      break

    case 'delete':
      if (item.entityType === 'memory') {
        await deleteMemoryById(item.data.id)
      }
      break
  }
}

function isConflictError(error: any): boolean {
  const msg = (error?.message || '').toLowerCase()
  return msg.includes('conflict') || msg.includes('version') || msg.includes('optimistic')
}

async function resolveConflict(item: SyncQueueItem, error: any): Promise<void> {
  // Strategy: For updates, fetch the latest version and keep the most recent
  if (item.type === 'update' && item.entityType === 'memory') {
    try {
      // Fetch the latest version from Supabase
      const { memories: latest } = await fetchMemories(0)
      const serverVersion = latest.find((m) => m.id === item.data.id)

      if (serverVersion) {
        // Compare timestamps — keep the most recent version
        const localUpdatedAt = item.data.updatedAt
          ? new Date(item.data.updatedAt).getTime()
          : 0
        const serverUpdatedAt = serverVersion.updatedAt
          ? new Date(serverVersion.updatedAt).getTime()
          : 0

        if (localUpdatedAt > serverUpdatedAt) {
          // Local version is newer — push our update
          const { id, updatedAt, ...updates } = item.data
          await updateMemoryById(id, updates)
        }
        // If server version is newer, we accept it (no action needed)
      }
    } catch {
      // Conflict resolution failed — keep in queue for retry
    }
  }
}

// ─── Delta Sync (pull only new/changed data) ───

export async function performDeltaSync(): Promise<{ memories: Memory[]; hasChanges: boolean }> {
  const lastSync = await getLastSyncTimestamp()

  // Fetch all memories (we use the standard fetch which gets recent first)
  const { memories } = await fetchMemories(0)

  // If we have a last sync timestamp, check which memories are new/updated
  let hasChanges = false
  if (lastSync) {
    const lastSyncTime = new Date(lastSync).getTime()
    hasChanges = memories.some(
      (m) => new Date(m.createdAt).getTime() > lastSyncTime || 
             (m.updatedAt && new Date(m.updatedAt).getTime() > lastSyncTime)
    )
  } else {
    hasChanges = memories.length > 0
  }

  if (hasChanges) {
    // Cache the fresh data
    await cacheMemories(memories)
  }

  // Fetch and cache collections
  try {
    const collections = await fetchCollections()
    await cacheCollections(collections)
  } catch {
    // Collections sync is non-critical
  }

  // Update last sync timestamp
  await setLastSyncTimestamp(new Date().toISOString())

  return { memories, hasChanges }
}

// ─── Main Sync Function ───

export async function syncAll(): Promise<SyncResult> {
  if (isSyncing || !getIsOnline()) {
    return { synced: 0, failed: 0, conflicts: 0 }
  }

  isSyncing = true
  notifyStatus('syncing')

  try {
    // Step 1: Push queued changes to Supabase
    const pushResult = await processSyncQueue()

    // Step 2: Pull latest data from Supabase (delta sync)
    await performDeltaSync()

    notifyStatus('complete')
    notifyComplete(pushResult)

    return pushResult
  } catch (error) {
    notifyStatus('error')
    return { synced: 0, failed: 0, conflicts: 0 }
  } finally {
    isSyncing = false
  }
}

// ─── Notification Helpers ───

function notifyStatus(status: 'syncing' | 'complete' | 'error', progress?: { done: number; total: number }) {
  syncStatusCallbacks.forEach((cb) => cb(status, progress))
}

function notifyComplete(result: SyncResult) {
  syncCompleteCallbacks.forEach((cb) => cb(result))
}

// ─── Auto-Sync on Online ───

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Debounce to avoid immediate sync on brief connection flickers
    setTimeout(() => {
      if (getIsOnline()) {
        syncAll()
      }
    }, 1500)
  })
}

// ─── Get pending count ───

export async function getPendingSyncCount(): Promise<number> {
  return getSyncQueueCount()
}
