// IndexedDB-based offline storage layer for Aether
// Provides persistent caching of memories, collections, and a sync queue

import type { Memory, Collection } from '@/components/aether/types'

const DB_NAME = 'aether-offline'
const DB_VERSION = 1

const STORES = {
  memories: 'memories',
  collections: 'collections',
  syncQueue: 'syncQueue',
  meta: 'meta',
} as const

// ─── IndexedDB Connection ───

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Memories store — indexed by id and userId
      if (!db.objectStoreNames.contains(STORES.memories)) {
        const memStore = db.createObjectStore(STORES.memories, { keyPath: 'id' })
        memStore.createIndex('userId', 'userId', { unique: false })
        memStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Collections store — indexed by id and userId
      if (!db.objectStoreNames.contains(STORES.collections)) {
        const colStore = db.createObjectStore(STORES.collections, { keyPath: 'id' })
        colStore.createIndex('userId', 'userId', { unique: false })
      }

      // Sync queue — pending operations to sync when back online
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        const syncStore = db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true })
        syncStore.createIndex('type', 'type', { unique: false })
        syncStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Meta store — last sync timestamp, etc.
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

// ─── Generic Helpers ───

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function putToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(item)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ─── Memories Cache ───

export async function cacheMemories(memories: Memory[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.memories, 'readwrite')
  const store = tx.objectStore(STORES.memories)

  // Clear existing cache and replace with fresh data
  store.clear()
  for (const memory of memories) {
    store.put(memory)
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function cacheMemory(memory: Memory): Promise<void> {
  await putToStore(STORES.memories, memory)
}

export async function getCachedMemories(): Promise<Memory[]> {
  const memories = await getAllFromStore<Memory>(STORES.memories)
  // Sort by createdAt descending (newest first)
  return memories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getCachedMemory(id: string): Promise<Memory | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.memories, 'readonly')
    const store = tx.objectStore(STORES.memories)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as Memory | null || null)
    request.onerror = () => reject(request.error)
  })
}

export async function deleteCachedMemory(id: string): Promise<void> {
  await deleteFromStore(STORES.memories, id)
}

export async function updateCachedMemory(id: string, updates: Partial<Memory>): Promise<void> {
  const existing = await getCachedMemory(id)
  if (existing) {
    await putToStore(STORES.memories, { ...existing, ...updates })
  }
}

// ─── Collections Cache ───

export async function cacheCollections(collections: Collection[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.collections, 'readwrite')
  const store = tx.objectStore(STORES.collections)

  store.clear()
  for (const collection of collections) {
    store.put(collection)
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function cacheCollection(collection: Collection): Promise<void> {
  await putToStore(STORES.collections, collection)
}

export async function getCachedCollections(): Promise<Collection[]> {
  return getAllFromStore<Collection>(STORES.collections)
}

// ─── Sync Queue ───

export interface SyncQueueItem {
  id?: number
  type: 'create' | 'update' | 'delete'
  entityType: 'memory' | 'collection'
  data: Record<string, any>
  tempId?: string // For create operations, the temp ID to replace
  createdAt: string
  retryCount: number
  lastError?: string
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'retryCount'>): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.syncQueue, 'readwrite')
    const store = tx.objectStore(STORES.syncQueue)
    const request = store.add({ ...item, retryCount: 0 })
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await getAllFromStore<SyncQueueItem>(STORES.syncQueue)
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function removeFromSyncQueue(id: number): Promise<void> {
  await deleteFromStore(STORES.syncQueue, String(id))
}

export async function updateSyncQueueItem(id: number, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.syncQueue, 'readwrite')
    const store = tx.objectStore(STORES.syncQueue)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (existing) {
        store.put({ ...existing, ...updates })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearSyncQueue(): Promise<void> {
  await clearStore(STORES.syncQueue)
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.syncQueue, 'readonly')
    const store = tx.objectStore(STORES.syncQueue)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── Meta Store ───

export async function setMeta(key: string, value: any): Promise<void> {
  await putToStore(STORES.meta, { key, value })
}

export async function getMeta(key: string): Promise<any> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.meta, 'readonly')
    const store = tx.objectStore(STORES.meta)
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result as { key: string; value: any } | null
      resolve(result?.value ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return getMeta('lastSyncTimestamp')
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  await setMeta('lastSyncTimestamp', timestamp)
}

// ─── Initialize ───

export async function initOfflineDB(): Promise<void> {
  await openDB()
}
