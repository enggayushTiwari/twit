-- Fix: Add SELECT and UPDATE policies for raw_ideas table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Allow reading all ideas (needed for generation engine + ideas page)
CREATE POLICY "Allow anonymous reads"
ON raw_ideas
FOR SELECT
TO public
USING (true);

-- Allow reading all generated tweets (needed for review page)
CREATE POLICY "Allow anonymous reads on tweets"
ON generated_tweets
FOR SELECT
TO public
USING (true);

-- Allow updating tweets (needed for approve/reject)
CREATE POLICY "Allow anonymous updates on tweets"
ON generated_tweets
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
