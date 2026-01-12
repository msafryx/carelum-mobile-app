-- ============================================
-- CLEANUP AND FIX STORAGE POLICIES
-- ============================================
-- This script removes ALL conflicting policies and creates only the 4 correct ones
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies for profile-images bucket
-- (This removes both the old vejz8c_ policies and any duplicates)

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

-- Step 2: Create ONLY the 4 correct policies

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

-- Step 3: Verify the policies
SELECT 
  policyname as "Policy Name",
  cmd as "Operation",
  roles as "Applied To"
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%profile%'
ORDER BY cmd, policyname;

-- You should see exactly 4 policies:
-- 1. INSERT → authenticated
-- 2. UPDATE → authenticated  
-- 3. SELECT → public
-- 4. DELETE → authenticated
