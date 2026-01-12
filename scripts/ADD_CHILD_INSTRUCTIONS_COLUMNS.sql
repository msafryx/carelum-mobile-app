-- Add missing columns to child_instructions table for chatbot RAG
-- Run this in Supabase SQL Editor
-- 
-- IMPORTANT: This script adds new columns WITHOUT dropping old ones.
-- This ensures backward compatibility while migrating.

-- Step 1: Add all new columns (including medications JSONB - keep medication TEXT for now)
ALTER TABLE child_instructions
  ADD COLUMN IF NOT EXISTS bedtime TEXT,
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS favorite_activities JSONB,
  ADD COLUMN IF NOT EXISTS comfort_items JSONB,
  ADD COLUMN IF NOT EXISTS routines TEXT,
  ADD COLUMN IF NOT EXISTS special_needs TEXT,
  ADD COLUMN IF NOT EXISTS doctor_info JSONB,
  ADD COLUMN IF NOT EXISTS additional_notes TEXT,
  ADD COLUMN IF NOT EXISTS medications JSONB;  -- Add medications (JSONB) - keep medication (TEXT) temporarily

-- Step 2: Migrate allergies from TEXT to JSONB (if it's currently TEXT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'child_instructions' 
    AND column_name = 'allergies' 
    AND data_type = 'text'
  ) THEN
    -- Add new JSONB column for allergies (temporary name)
    ALTER TABLE child_instructions ADD COLUMN IF NOT EXISTS allergies_jsonb_temp JSONB;
    
    -- Migrate existing TEXT data to JSONB
    UPDATE child_instructions
    SET allergies_jsonb_temp = CASE
      WHEN allergies IS NULL OR allergies = '' THEN NULL
      WHEN allergies::text LIKE '[%' OR allergies::text LIKE '{%' THEN allergies::jsonb
      ELSE jsonb_build_array(allergies)
    END
    WHERE allergies IS NOT NULL;
    
    -- Drop old TEXT column and rename new one
    ALTER TABLE child_instructions DROP COLUMN IF EXISTS allergies;
    ALTER TABLE child_instructions RENAME COLUMN allergies_jsonb_temp TO allergies;
  END IF;
END $$;

-- Step 3: Migrate medication (TEXT) to medications (JSONB)
-- Only migrate if old medication column exists and medications doesn't have data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'child_instructions' 
    AND column_name = 'medication'
    AND data_type = 'text'
  ) THEN
    -- Migrate data from medication (TEXT) to medications (JSONB)
    UPDATE child_instructions
    SET medications = CASE
      WHEN medication IS NOT NULL AND medication != '' THEN
        CASE
          WHEN medication::text LIKE '[%' OR medication::text LIKE '{%' THEN medication::jsonb
          ELSE jsonb_build_array(medication)
        END
      ELSE NULL
    END
    WHERE medications IS NULL 
      AND medication IS NOT NULL 
      AND medication != '';
  END IF;
END $$;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN child_instructions.bedtime IS 'Child bedtime (e.g., 8:00 PM)';
COMMENT ON COLUMN child_instructions.dietary_restrictions IS 'Dietary restrictions (e.g., No nuts, vegetarian)';
COMMENT ON COLUMN child_instructions.favorite_activities IS 'Array of favorite activities (JSONB)';
COMMENT ON COLUMN child_instructions.comfort_items IS 'Array of comfort items (JSONB)';
COMMENT ON COLUMN child_instructions.routines IS 'Daily routines and rituals';
COMMENT ON COLUMN child_instructions.special_needs IS 'Special care requirements';
COMMENT ON COLUMN child_instructions.doctor_info IS 'Doctor information: {name, phone, clinic} (JSONB)';
COMMENT ON COLUMN child_instructions.additional_notes IS 'Any other important information';
COMMENT ON COLUMN child_instructions.allergies IS 'Array of allergies (JSONB)';
COMMENT ON COLUMN child_instructions.medications IS 'Array of medications: [{name, dosage, time, notes}] (JSONB)';

-- Step 5: Create indexes for better querying (for chatbot RAG)
CREATE INDEX IF NOT EXISTS idx_child_instructions_allergies ON child_instructions USING GIN (allergies) WHERE allergies IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_child_instructions_medications ON child_instructions USING GIN (medications) WHERE medications IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_child_instructions_favorite_activities ON child_instructions USING GIN (favorite_activities) WHERE favorite_activities IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_child_instructions_comfort_items ON child_instructions USING GIN (comfort_items) WHERE comfort_items IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_child_instructions_doctor_info ON child_instructions USING GIN (doctor_info) WHERE doctor_info IS NOT NULL;

-- Step 6: (OPTIONAL - Run after verifying everything works)
-- After confirming all data is migrated and the app works correctly,
-- you can drop the old 'medication' column:
-- ALTER TABLE child_instructions DROP COLUMN IF EXISTS medication;
