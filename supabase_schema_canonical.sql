-- IDEA ENGINE: CANONICAL SUPABASE SCHEMA
-- This file is the single source of truth for a fresh setup.
-- Legacy SQL files remain in the repo for historical context, but new environments
-- should use this file instead of replaying the older phased migrations.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS raw_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  type text NOT NULL DEFAULT 'idea',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT generated_tweets_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'OPENED_IN_X', 'PUBLISHED'))
);

CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desired_perception text NOT NULL DEFAULT '',
  target_audience text NOT NULL DEFAULT '',
  tone_guardrails text NOT NULL DEFAULT '',
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL,
  golden_tweets jsonb NOT NULL,
  ai_voice_profile text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE raw_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON raw_ideas;
DROP POLICY IF EXISTS "Allow anonymous reads" ON raw_ideas;
DROP POLICY IF EXISTS "Allow anonymous deletions on raw_ideas" ON raw_ideas;
CREATE POLICY "Allow anonymous inserts" ON raw_ideas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow anonymous reads" ON raw_ideas FOR SELECT TO public USING (true);
CREATE POLICY "Allow anonymous deletions on raw_ideas" ON raw_ideas FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Allow anonymous access to generated_tweets" ON generated_tweets;
DROP POLICY IF EXISTS "Allow anonymous reads on tweets" ON generated_tweets;
DROP POLICY IF EXISTS "Allow anonymous updates on tweets" ON generated_tweets;
CREATE POLICY "Allow anonymous reads on tweets" ON generated_tweets FOR SELECT TO public USING (true);
CREATE POLICY "Allow anonymous inserts on tweets" ON generated_tweets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow anonymous updates on tweets" ON generated_tweets FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous full access to user_profile" ON user_profile;
CREATE POLICY "Allow anonymous full access to user_profile" ON user_profile FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to creator_personas" ON creator_personas;
CREATE POLICY "Allow all access to creator_personas" ON creator_personas FOR ALL TO public USING (true) WITH CHECK (true);

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
  WHERE raw_ideas.embedding IS NOT NULL
    AND 1 - (raw_ideas.embedding <=> query_embedding) > match_threshold
  ORDER BY 1 - (raw_ideas.embedding <=> query_embedding) DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_ideas TO anon;
GRANT EXECUTE ON FUNCTION match_ideas TO authenticated;
GRANT EXECUTE ON FUNCTION match_ideas TO service_role;

INSERT INTO user_profile (desired_perception, target_audience, tone_guardrails)
SELECT '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM user_profile);
