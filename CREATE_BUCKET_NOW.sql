-- ============================================
-- CREATE BUCKET AND POLICIES - RUN THIS NOW
-- ============================================
-- Copy and paste this ENTIRE script into Supabase SQL Editor and run it

-- Step 1: Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Step 2: Drop ALL existing policies (cleanup)
DROP POLICY IF EXISTS "Allow Authenticated Users to Upload vejz8c_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Update their profile vejz8c_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Update their profile vejz8c_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read Access vejz8c_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Delete vejz8c_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Users to Delete vejz8c_1" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own profile images" ON storage.objects;

-- Step 3: Create ONLY the 4 correct policies

-- Policy 1: INSERT - Only authenticated users can upload to their own folder
CREATE POLICY "Allow authenticated users to upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 2: UPDATE - Only authenticated users can update their own files
CREATE POLICY "Allow authenticated users to update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 3: SELECT - Public read access (anyone can view profile images)
CREATE POLICY "Allow public read access to profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Policy 4: DELETE - Only authenticated users can delete their own files
CREATE POLICY "Allow authenticated users to delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Step 4: Verify
SELECT 
  id,
  name,
  public,
  file_size_limit
FROM storage.buckets
WHERE id = 'profile-images';

-- You should see the bucket listed above
-- Then go to Storage → profile-images → Policies tab
-- You should see exactly 4 policies, all Active
