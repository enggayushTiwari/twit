-- IDEA ENGINE: CANONICAL SUPABASE SCHEMA
-- This file is the single source of truth for the current product shape.
-- It is written to be rerunnable against an existing project where the early
-- tables already exist.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS raw_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  type text NOT NULL DEFAULT 'idea',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(3072),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE raw_ideas ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'idea';
ALTER TABLE raw_ideas ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE raw_ideas ADD COLUMN IF NOT EXISTS embedding vector(3072);

CREATE TABLE IF NOT EXISTS generated_tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  theses jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternates jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text NOT NULL DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE generated_tweets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING';
ALTER TABLE generated_tweets ADD COLUMN IF NOT EXISTS theses jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE generated_tweets ADD COLUMN IF NOT EXISTS alternates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE generated_tweets ADD COLUMN IF NOT EXISTS rationale text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generated_tweets_status_check'
  ) THEN
    ALTER TABLE generated_tweets
      ADD CONSTRAINT generated_tweets_status_check
      CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'OPENED_IN_X', 'PUBLISHED'));
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS mind_model_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'suggested',
  confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  priority integer NOT NULL DEFAULT 1,
  source_type text NOT NULL DEFAULT '',
  source_ref_id text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_summary text NOT NULL DEFAULT '',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mind_model_entries_kind_check'
  ) THEN
    ALTER TABLE mind_model_entries
      ADD CONSTRAINT mind_model_entries_kind_check
      CHECK (kind IN (
        'belief',
        'lens',
        'taste_like',
        'taste_avoid',
        'current_obsession',
        'open_question',
        'event_pov',
        'voice_rule'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mind_model_entries_status_check'
  ) THEN
    ALTER TABLE mind_model_entries
      ADD CONSTRAINT mind_model_entries_status_check
      CHECK (status IN ('suggested', 'confirmed', 'rejected', 'archived'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reflection_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  prompt text NOT NULL,
  answer text NOT NULL DEFAULT '',
  context_ref_type text NOT NULL DEFAULT '',
  context_ref_id text,
  derived_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reflection_turns_mode_check'
  ) THEN
    ALTER TABLE reflection_turns
      ADD CONSTRAINT reflection_turns_mode_check
      CHECK (mode IN ('capture_followup', 'broad_reflection', 'news_reflection', 'draft_feedback'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS draft_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_tweet_id uuid NOT NULL REFERENCES generated_tweets(id) ON DELETE CASCADE,
  decision text NOT NULL,
  original_content text NOT NULL,
  edited_content text,
  feedback_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  freeform_note text NOT NULL DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL DEFAULT '',
  source_url text,
  source_summary text NOT NULL DEFAULT '',
  user_take text,
  derived_thesis text,
  status text NOT NULL DEFAULT 'captured',
  created_at timestamp with time zone DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_reflections_status_check'
  ) THEN
    ALTER TABLE event_reflections
      ADD CONSTRAINT event_reflections_status_check
      CHECK (status IN ('captured', 'reflected', 'archived'));
  END IF;
END $$;

ALTER TABLE raw_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mind_model_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON raw_ideas;
DROP POLICY IF EXISTS "Allow anonymous reads" ON raw_ideas;
DROP POLICY IF EXISTS "Allow anonymous deletions on raw_ideas" ON raw_ideas;
CREATE POLICY "Allow anonymous inserts" ON raw_ideas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow anonymous reads" ON raw_ideas FOR SELECT TO public USING (true);
CREATE POLICY "Allow anonymous deletions on raw_ideas" ON raw_ideas FOR DELETE TO public USING (true);

DROP POLICY IF EXISTS "Allow anonymous reads on tweets" ON generated_tweets;
DROP POLICY IF EXISTS "Allow anonymous inserts on tweets" ON generated_tweets;
DROP POLICY IF EXISTS "Allow anonymous updates on tweets" ON generated_tweets;
CREATE POLICY "Allow anonymous reads on tweets" ON generated_tweets FOR SELECT TO public USING (true);
CREATE POLICY "Allow anonymous inserts on tweets" ON generated_tweets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow anonymous updates on tweets" ON generated_tweets FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous full access to user_profile" ON user_profile;
CREATE POLICY "Allow anonymous full access to user_profile" ON user_profile FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to creator_personas" ON creator_personas;
CREATE POLICY "Allow all access to creator_personas" ON creator_personas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to mind_model_entries" ON mind_model_entries;
CREATE POLICY "Allow all access to mind_model_entries" ON mind_model_entries FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to reflection_turns" ON reflection_turns;
CREATE POLICY "Allow all access to reflection_turns" ON reflection_turns FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to draft_feedback" ON draft_feedback;
CREATE POLICY "Allow all access to draft_feedback" ON draft_feedback FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to event_reflections" ON event_reflections;
CREATE POLICY "Allow all access to event_reflections" ON event_reflections FOR ALL TO public USING (true) WITH CHECK (true);

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
