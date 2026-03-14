-- Step 1: Create the generated_tweets table
CREATE TABLE generated_tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  status text DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable RLS and add policies
ALTER TABLE generated_tweets ENABLE ROW LEVEL SECURITY;

-- Temporary policy for MVP
CREATE POLICY "Allow anonymous access to generated_tweets" 
ON generated_tweets 
FOR ALL 
TO public 
USING (true)
WITH CHECK (true);

-- Step 3: Create the postgres function for vector similarity search
-- This function takes a query vector, a similarity threshold, and a limit
-- and returns matching ideas sorted by cosine distance (<=>).
CREATE OR REPLACE FUNCTION match_ideas(
  query_embedding vector(1536),
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
  WHERE 1 - (raw_ideas.embedding <=> query_embedding) > match_threshold
  ORDER BY raw_ideas.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
