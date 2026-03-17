-- ==========================================
-- SUPABASE VECTOR SEARCH FIX (FOR GOOGLE GEMINI)
-- ==========================================

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Cleanly recreate the embedding column for 768 dimensions
-- This avoids the "expected 768 dimensions, not 1536" error when data exists.
ALTER TABLE raw_ideas DROP COLUMN IF EXISTS embedding;
ALTER TABLE raw_ideas ADD COLUMN embedding vector(768);

-- 3. Update the match_ideas function for 768 dimensions
CREATE OR REPLACE FUNCTION match_ideas(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    raw_ideas.id,
    raw_ideas.content,
    1 - (raw_ideas.embedding <=> query_embedding) AS similarity
  FROM raw_ideas
  WHERE 
    raw_ideas.embedding IS NOT NULL -- Safety check
    AND 1 - (raw_ideas.embedding <=> query_embedding) > match_threshold
  ORDER BY 1 - (raw_ideas.embedding <=> query_embedding) DESC
  LIMIT match_count;
END;
$$;

-- 4. Grant access to the function for the API (anon / service_role)
GRANT EXECUTE ON FUNCTION match_ideas TO anon;
GRANT EXECUTE ON FUNCTION match_ideas TO authenticated;
GRANT EXECUTE ON FUNCTION match_ideas TO service_role;
