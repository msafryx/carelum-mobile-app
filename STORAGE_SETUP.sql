-- ============================================
-- SUPABASE STORAGE SETUP - COMPLETE
-- ============================================
-- This script sets up all storage buckets and policies for the Carelum app
-- Run this ENTIRE script in Supabase SQL Editor
--
-- Buckets created:
-- 1. profile-images - For user profile pictures
-- 2. child-images - For child profile pictures
--
-- Each bucket has 4 RLS policies: INSERT, UPDATE, SELECT, DELETE
-- ============================================

-- ============================================
-- PART 1: PROFILE IMAGES BUCKET
-- ============================================

-- Step 1: Create profile-images bucket
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

-- Step 2: Drop ALL existing policies for profile-images (cleanup)
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

-- Step 3: Create 4 correct policies for profile-images

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

-- ============================================
-- PART 2: CHILD IMAGES BUCKET
-- ============================================

-- Step 1: Create child-images bucket
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

-- Step 3: Create 4 correct policies for child-images

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

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify buckets exist
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('profile-images', 'child-images')
ORDER BY id;

-- Verify policies (should see 8 policies total: 4 for each bucket)
SELECT 
  policyname as "Policy Name",
  cmd as "Operation",
  roles as "Applied To"
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname LIKE '%profile%' OR policyname LIKE '%child%')
ORDER BY policyname, cmd;

-- Expected results:
-- profile-images bucket: 4 policies (INSERT, UPDATE, SELECT, DELETE)
-- child-images bucket: 4 policies (INSERT, UPDATE, SELECT, DELETE)
-- Total: 8 policies, all Active
