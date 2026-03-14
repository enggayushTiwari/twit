-- Step 1: Create the table
CREATE TABLE raw_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable Row Level Security (RLS)
ALTER TABLE raw_ideas ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a temporary policy to allow anonymous inserts
-- WARNNG: This allows anyone to insert data. Use for MVP/testing only.
CREATE POLICY "Allow anonymous inserts" 
ON raw_ideas 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Optional: If you want to view your inserted data in the Supabase dashboard
-- temporarily, you might also want a select policy for anon/public, but 
-- the prompt only specified needing inserts for the UI right now.
