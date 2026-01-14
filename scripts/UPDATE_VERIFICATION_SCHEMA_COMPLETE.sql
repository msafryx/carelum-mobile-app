-- ============================================
-- COMPLETE VERIFICATION SCHEMA UPDATE
-- ============================================
-- This script updates the verification_requests table to support:
-- 1. 'under_review' status
-- 2. qualifications_text column
-- 3. Proper document verification structure
-- Run this in Supabase SQL Editor

-- Step 1: Add 'under_review' to status CHECK constraint
ALTER TABLE verification_requests 
DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE verification_requests 
ADD CONSTRAINT verification_requests_status_check 
CHECK (status IN ('pending', 'under_review', 'approved', 'rejected'));

-- Step 2: Add qualifications_text column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'verification_requests' 
    AND column_name = 'qualifications_text'
  ) THEN
    ALTER TABLE verification_requests 
    ADD COLUMN qualifications_text TEXT;
  END IF;
END $$;

-- Step 3: Create index on qualifications_text for better search
CREATE INDEX IF NOT EXISTS idx_verification_requests_qualifications 
ON verification_requests USING gin(to_tsvector('english', qualifications_text));

-- Step 4: Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_status 
ON verification_requests(status);

-- Step 5: Create index on sitter_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_requests_sitter_id 
ON verification_requests(sitter_id);

-- Step 6: Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at 
ON verification_requests(created_at DESC);

-- Step 7: Add comment to documents column for documentation
COMMENT ON COLUMN verification_requests.documents IS 
'JSONB structure: {
  "idDocument": {"url": "...", "verified": boolean, "adminComment": "..."},
  "backgroundCheck": {"url": "...", "verified": boolean, "adminComment": "..."},
  "qualificationDocument": {"url": "...", "verified": boolean, "adminComment": "..."},
  "certifications": [{"name": "...", "url": "...", "issuedDate": "...", "expiryDate": "...", "verified": boolean, "adminComment": "..."}],
  "bio": "...",
  "hourlyRate": number
}';

-- Step 8: Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS update_verification_requests_updated_at ON verification_requests;

CREATE TRIGGER update_verification_requests_updated_at
BEFORE UPDATE ON verification_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Verification: Check the updated schema
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'verification_requests'
ORDER BY ordinal_position;
