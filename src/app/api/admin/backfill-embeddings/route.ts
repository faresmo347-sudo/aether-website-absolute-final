import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateEmbedding, buildMemoryEmbeddingText, isZeroVector } from '@/lib/embeddings'

/**
 * POST /api/admin/backfill-embeddings
 *
 * Backfills embeddings for all memories that don't have one yet.
 * This is an admin endpoint — it uses the server-side Supabase client
 * with service_role privileges to read all memories and update their embeddings.
 *
 * Query params:
 *   - batchSize: number of memories to process per call (default 20, max 50)
 *   - force: if "true", re-generates embeddings even for memories that already have one
 *
 * Returns:
 *   - processed: number of memories processed
 *   - succeeded: number of embeddings successfully stored
 *   - failed: number of embeddings that failed
 *   - hasMore: whether there are more memories without embeddings
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const batchSize = Math.min(parseInt(url.searchParams.get('batchSize') || '20'), 50)
    const force = url.searchParams.get('force') === 'true'

    // Authenticate using the server-side Supabase client
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch memories without embeddings (or all if force=true)
    let query = supabase
      .from('memories')
      .select('id, title, content, tags, summary')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(batchSize)

    if (!force) {
      // Only get memories where embedding is NULL
      query = query.is('embedding', null)
    }

    const { data: memories, error: fetchError } = await query

    if (fetchError) {
      console.error('[Backfill] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch memories', details: fetchError.message }, { status: 500 })
    }

    if (!memories || memories.length === 0) {
      return NextResponse.json({
        processed: 0,
        succeeded: 0,
        failed: 0,
        hasMore: false,
        message: 'No memories need embeddings — all caught up!',
      })
    }

    let succeeded = 0
    let failed = 0

    // Process memories sequentially to avoid rate limiting
    for (const memory of memories) {
      try {
        const textToEmbed = buildMemoryEmbeddingText({
          title: memory.title || '',
          content: memory.content || '',
          tags: memory.tags || [],
          aiSummary: memory.summary || undefined,
        })

        const embedding = await generateEmbedding(textToEmbed)

        if (isZeroVector(embedding)) {
          failed++
          continue
        }

        // Store the embedding using the SECURITY DEFINER function
        const { error: updateError } = await supabase.rpc('update_memory_embedding', {
          memory_id: memory.id,
          new_embedding: embedding,
        })

        if (updateError) {
          console.warn(`[Backfill] Failed to store embedding for ${memory.id}:`, updateError.message)
          failed++
        } else {
          succeeded++
        }

        // Small delay to avoid hitting HF API rate limits
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.warn(`[Backfill] Error processing memory ${memory.id}:`, error)
        failed++
      }
    }

    // Check if there are more memories without embeddings
    const { count } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('embedding', null)

    const hasMore = (count || 0) > 0

    return NextResponse.json({
      processed: memories.length,
      succeeded,
      failed,
      hasMore,
      remaining: count || 0,
      message: `Processed ${memories.length} memories: ${succeeded} succeeded, ${failed} failed.${hasMore ? ` ${count} remaining.` : ' All done!'}`,
    })
  } catch (error) {
    console.error('[Backfill] Fatal error:', error)
    return NextResponse.json({
      error: 'Backfill failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/backfill-embeddings
 *
 * Returns the count of memories with and without embeddings.
 * Useful for checking backfill progress.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Count memories with embeddings
    const { count: withEmbedding } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('embedding', 'is', null)

    // Count memories without embeddings
    const { count: withoutEmbedding } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('embedding', null)

    // Count total memories
    const { count: total } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      total: total || 0,
      withEmbedding: withEmbedding || 0,
      withoutEmbedding: withoutEmbedding || 0,
      progress: total ? `${Math.round(((withEmbedding || 0) / total) * 100)}%` : '0%',
    })
  } catch (error) {
    console.error('[Backfill] Status check error:', error)
    return NextResponse.json({
      error: 'Failed to check embedding status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
