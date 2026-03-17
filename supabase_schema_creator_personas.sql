-- Create creator_personas table
CREATE TABLE IF NOT EXISTS creator_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL,
    golden_tweets JSONB NOT NULL,
    ai_voice_profile TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE creator_personas ENABLE ROW LEVEL SECURITY;

-- Create policy for all access (since this is a scratch/demo project typically)
CREATE POLICY "Allow all access to creator_personas" ON creator_personas
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
