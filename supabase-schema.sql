-- =============================================
-- AETHER DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );

  -- Create default collections for new user
  INSERT INTO public.collections (user_id, name, icon, color) VALUES
    (NEW.id, 'Work', 'briefcase', '#6D597A'),
    (NEW.id, 'Ideas', 'lightbulb', '#F59E0B'),
    (NEW.id, 'Travel', 'plane', '#3B82F6'),
    (NEW.id, 'Books', 'book-open', '#10B981'),
    (NEW.id, 'Recipes', 'chef-hat', '#EF4444'),
    (NEW.id, 'Personal', 'heart', '#EC4899');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-create profile + collections on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice', 'link', 'image')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_url TEXT,
  file_url TEXT,
  image_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_type ON public.memories(user_id, type);

-- 3. COLLECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  color TEXT NOT NULL DEFAULT '#6D597A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);

-- 4. MEMORY_COLLECTIONS JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.memory_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE NOT NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(memory_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_collections_memory ON public.memory_collections(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_collections_collection ON public.memory_collections(collection_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Profiles: users can only read/update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Memories: full CRUD for own memories only
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memories" ON public.memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own memories" ON public.memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.memories FOR DELETE USING (auth.uid() = user_id);

-- Collections: full CRUD for own collections only
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own collections" ON public.collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own collections" ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.collections FOR DELETE USING (auth.uid() = user_id);

-- Memory_Collections: access through ownership of both memory and collection
ALTER TABLE public.memory_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memory_collections" ON public.memory_collections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.memories WHERE memories.id = memory_collections.memory_id AND memories.user_id = auth.uid())
);
CREATE POLICY "Users can create own memory_collections" ON public.memory_collections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.memories WHERE memories.id = memory_collections.memory_id AND memories.user_id = auth.uid()) AND
  EXISTS (SELECT 1 FROM public.collections WHERE collections.id = memory_collections.collection_id AND collections.user_id = auth.uid())
);
CREATE POLICY "Users can delete own memory_collections" ON public.memory_collections FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.memories WHERE memories.id = memory_collections.memory_id AND memories.user_id = auth.uid())
);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_memory_updated ON public.memories;
CREATE TRIGGER on_memory_updated
  BEFORE UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
