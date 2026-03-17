-- Add metadata column to raw_ideas to store source URLs and titles
ALTER TABLE raw_ideas ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
