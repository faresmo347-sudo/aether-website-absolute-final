-- =============================================
-- AETHER EMBEDDINGS MIGRATION
-- Run this in Supabase SQL Editor after the base schema
-- Enables pgvector for semantic search
-- =============================================

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add embedding column to memories table
-- Uses vector(384) to match sentence-transformers/all-MiniLM-L6-v2 output
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS embedding public.vector(384);

-- 3. Create an IVFFlat index on the embedding column for fast ANN search
-- Only created when there are enough rows (>1000 for ivfflat to be effective)
-- For smaller datasets, a basic GiST index or sequential scan is fine
-- The index will be built with default lists = sqrt(rows)
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON public.memories
  USING ivfflat (embedding public.vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create the match_memories function for semantic search
-- Takes a query embedding and user_id, returns top N most similar memories
-- using cosine similarity (1 - cosine distance)
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding public.vector(384),
  matching_user_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  source_url TEXT,
  file_url TEXT,
  image_preview TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.type,
    m.title,
    m.content,
    m.summary,
    m.tags,
    m.source_url,
    m.file_url,
    m.image_preview,
    m.created_at,
    m.updated_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.memories m
  WHERE m.user_id = matching_user_id
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Allow the service role to call match_memories (bypasses RLS for server-side search)
-- The function runs with the caller's privileges, so RLS still applies
-- for anon and authenticated users. For server-side calls using the service_role key,
-- RLS is bypassed automatically.

-- =============================================
-- HELPER: Function to update a memory's embedding
-- Used by the backfill script and save flow
-- =============================================
CREATE OR REPLACE FUNCTION public.update_memory_embedding(
  memory_id UUID,
  new_embedding public.vector(384)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.memories
  SET embedding = new_embedding
  WHERE id = memory_id;
END;
$$;

-- =============================================
-- GRANT permissions for service role
-- The service_role key already bypasses RLS,
-- but we ensure the function is executable
-- =============================================
GRANT EXECUTE ON FUNCTION public.match_memories TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories TO anon;
GRANT EXECUTE ON FUNCTION public.update_memory_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_memory_embedding TO anon;
