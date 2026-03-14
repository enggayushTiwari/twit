-- Step 1: Enable the pgvector extension (must run as superuser or database owner)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add the embedding column to the raw_ideas table
-- The 'text-embedding-3-small' model outputs 1536 dimensions
ALTER TABLE raw_ideas 
ADD COLUMN embedding vector(1536);
