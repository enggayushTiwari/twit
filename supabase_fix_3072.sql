-- ==========================================
-- SUPABASE VECTOR SEARCH FIX (FOR GEMINI 3072 DIMS)
-- ==========================================

-- 1. Enable the pgvector extension (just in case)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop and recreate the embedding column for 3072 dimensions
-- WARNING: This will clear existing embeddings!
ALTER TABLE raw_ideas DROP COLUMN IF EXISTS embedding;
ALTER TABLE raw_ideas ADD COLUMN embedding vector(3072);

-- 3. Update the match_ideas function for 3072 dimensions
CREATE OR REPLACE FUNCTION match_ideas(
  query_embedding vector(3072),
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

-- 4. Re-grant access (just in case)
GRANT EXECUTE ON FUNCTION match_ideas TO anon;
GRANT EXECUTE ON FUNCTION match_ideas TO authenticated;
GRANT EXECUTE ON FUNCTION match_ideas TO service_role;
