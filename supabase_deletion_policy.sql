-- SUPABASE DELETION POLICY FIX
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Allow anonymous deletions on raw_ideas
CREATE POLICY "Allow anonymous deletions on raw_ideas"
ON raw_ideas
FOR DELETE
TO public
USING (true);

-- 2. Ensure anonymous reads and inserts are also enabled (just in case they were lost)
-- These are usually already set up if you followed the previous steps.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous reads' AND tablename = 'raw_ideas') THEN
        CREATE POLICY "Allow anonymous reads" ON raw_ideas FOR SELECT TO public USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous inserts' AND tablename = 'raw_ideas') THEN
        CREATE POLICY "Allow anonymous inserts" ON raw_ideas FOR INSERT TO public WITH CHECK (true);
    END IF;
END $$;
