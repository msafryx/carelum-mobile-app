-- ============================================
-- CREATE CHILD IMAGES BUCKET AND POLICIES
-- ============================================
-- Copy and paste this ENTIRE script into Supabase SQL Editor and run it

-- Step 1: Create the child-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'child-images',
  'child-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Step 2: Drop ALL existing policies for child-images (cleanup)
DROP POLICY IF EXISTS "Allow Authenticated Users to Upload child-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Update child-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read Access child-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Delete child-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload child images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own child images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to child images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own child images" ON storage.objects;

-- Step 3: Create ONLY the 4 correct policies

-- Policy 1: INSERT - Only authenticated users can upload to their own folder
-- Path format: childImages/{userId}/{childId}_{timestamp}.jpg
CREATE POLICY "Allow authenticated users to upload child images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'child-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 2: UPDATE - Only authenticated users can update their own files
CREATE POLICY "Allow authenticated users to update their own child images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'child-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'child-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 3: SELECT - Public read access (anyone can view child images)
CREATE POLICY "Allow public read access to child images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'child-images');

-- Policy 4: DELETE - Only authenticated users can delete their own files
CREATE POLICY "Allow authenticated users to delete their own child images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'child-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Step 4: Verify
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'child-images';

-- You should see the bucket listed above
-- Then go to Storage → child-images → Policies tab
-- You should see exactly 4 policies, all Active
