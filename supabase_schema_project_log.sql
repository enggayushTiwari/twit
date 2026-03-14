-- Step 1: Add the type column
ALTER TABLE raw_ideas
ADD COLUMN type text DEFAULT 'idea';

-- Note: Existing rows will default to 'idea', which is perfect for our current data.
