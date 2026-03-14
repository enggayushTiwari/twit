-- Step 1: Add new columns for brand perception
ALTER TABLE user_profile
ADD COLUMN desired_perception text DEFAULT '',
ADD COLUMN target_audience text DEFAULT '',
ADD COLUMN tone_guardrails text DEFAULT '';

-- Step 2: Drop the old psychological columns
ALTER TABLE user_profile
DROP COLUMN core_enemy,
DROP COLUMN contrarian_truth,
DROP COLUMN communication_style;

-- At this point, the existing MVP row will retain its ID and timestamps,
-- and the new columns will be empty strings.
