-- Step 1: Create the user_profile table
CREATE TABLE user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_enemy text DEFAULT '',
  contrarian_truth text DEFAULT '',
  communication_style text DEFAULT '',
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable Row Level Security
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS policies for MVP (allow all operations for anon)
CREATE POLICY "Allow anonymous full access to user_profile"
ON user_profile
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Step 4: Insert a default empty profile row
-- (The app will upsert into this row)
INSERT INTO user_profile (core_enemy, contrarian_truth, communication_style)
VALUES ('', '', '');
