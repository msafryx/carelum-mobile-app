# Supabase Storage Setup for Profile Images

## 🚨 URGENT: If You See "Bucket does not exist" Error

**If you see `⚠️ Bucket "profile-images" not found in available buckets`, the bucket doesn't exist!**

**👉 RUN `CREATE_BUCKET_NOW.sql` in Supabase SQL Editor RIGHT NOW - it will create the bucket AND set up all policies in one go!**

## 🚨 IMPORTANT: If You See "Network request failed" Error

**If you have multiple conflicting policies (especially ones granting `INSERT`/`UPDATE`/`DELETE` to `public`), you MUST clean them up first!**

**Run `CLEANUP_STORAGE_POLICIES.sql` in Supabase SQL Editor to remove all conflicting policies and create only the 4 correct ones.**

This is the most common cause of "Network request failed" errors with `statusCode: undefined`.

## 📋 Prerequisites
- Access to your Supabase Dashboard
- Your Supabase project URL and anon key

## 🚀 Step-by-Step Setup

### Step 1: Create Storage Bucket

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** (left sidebar)
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `profile-images`
   - **Public bucket**: ✅ **Enable** (check this box)
   - **File size limit**: `5242880` (5MB) or leave default
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp` (optional, for security)
5. Click **"Create bucket"**

### Step 2: Set Up Storage Policies (RLS)

After creating the bucket, you need to set up Row Level Security (RLS) policies:

1. In the **Storage** section, click on the `profile-images` bucket
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Allow Authenticated Users to Upload

1. **Policy Name**: `Allow authenticated users to upload profile images`
2. **Allowed Operation**: `INSERT`
3. **Policy Definition**: Use this SQL (copy/paste in SQL Editor):

```sql
CREATE POLICY "Allow authenticated users to upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
```

**Explanation**: Users can only upload to their own folder (`{user_id}/`)

#### Policy 2: Allow Authenticated Users to Update Their Own Images

1. **Policy Name**: `Allow authenticated users to update their own profile images`
2. **Allowed Operation**: `UPDATE`
3. **Policy Definition**: Use this SQL:

```sql
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
```

#### Policy 3: Allow Public Read Access

1. **Policy Name**: `Allow public read access to profile images`
2. **Allowed Operation**: `SELECT`
3. **Policy Definition**: Use this SQL:

```sql
CREATE POLICY "Allow public read access to profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');
```

**Explanation**: Anyone can view profile images (public bucket)

#### Policy 4: Allow Authenticated Users to Delete Their Own Images

1. **Policy Name**: `Allow authenticated users to delete their own profile images`
2. **Allowed Operation**: `DELETE`
3. **Policy Definition**: Use this SQL:

```sql
CREATE POLICY "Allow authenticated users to delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
```

### Step 3: Verify Bucket Configuration

1. Go to **Storage** → `profile-images` bucket
2. Check that:
   - ✅ Bucket is **Public**
   - ✅ All 4 policies are created and **Active**
   - ✅ File size limit is set (5MB recommended)

### Step 4: Test Upload (Optional)

You can test the upload from Supabase Dashboard:
1. Go to **Storage** → `profile-images`
2. Click **"Upload file"**
3. Upload a test image
4. Verify it appears in the bucket

## 🔧 Alternative: Quick Setup via SQL

If you prefer SQL, run this in **Supabase SQL Editor**:

```sql
-- Create the bucket (if it doesn't exist)
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
  file_size_limit = 5242880;

-- Policy 1: Allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 2: Allow authenticated users to update their own images
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

-- Policy 3: Allow public read access
CREATE POLICY "Allow public read access to profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Policy 4: Allow authenticated users to delete their own images
CREATE POLICY "Allow authenticated users to delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
```

## ✅ Verification Checklist

After setup, verify:

- [ ] Bucket `profile-images` exists
- [ ] Bucket is set to **Public**
- [ ] 4 RLS policies are created and active:
  - [ ] INSERT policy (upload)
  - [ ] UPDATE policy (update)
  - [ ] SELECT policy (read)
  - [ ] DELETE policy (delete)
- [ ] File size limit is set (5MB)
- [ ] Test upload works from the app

## 🐛 Troubleshooting

### Error: "Bucket not found"
- **Solution**: Make sure the bucket name is exactly `profile-images` (with hyphen)
- **Check**: Go to Storage → Buckets and verify the bucket exists

### Error: "New row violates row-level security policy"
- **Solution**: Check that RLS policies are created and active. Verify the policy SQL matches the format above.
- **Check**: Go to Storage → `profile-images` → Policies tab and verify all 4 policies are **Active**
- **Fix**: Re-run the SQL setup script above (it will drop and recreate policies)

### Error: "Network request failed" or "Network error"
This is the most common issue. Try these steps:

1. **Verify Policies are Active:**
   - Go to Supabase Dashboard → Storage → `profile-images` → **Policies** tab
   - Make sure all 4 policies show as **Active** (green checkmark)
   - If any are inactive, click on them and verify the SQL is correct

2. **Check Policy SQL:**
   - The INSERT policy MUST use `WITH CHECK` (not just `USING`)
   - Verify the policy checks `bucket_id = 'profile-images'`
   - Verify it checks `(storage.foldername(name))[1] = (auth.uid())::text`

3. **Re-run SQL Setup:**
   - Copy the entire SQL block from "Quick Setup via SQL" section above
   - Run it in Supabase SQL Editor
   - This will drop and recreate all policies correctly

4. **Verify Authentication:**
   - Make sure you're logged in to the app
   - Try logging out and back in
   - Check browser console for authentication errors

5. **Check CORS (if using web):**
   - Supabase Storage should handle CORS automatically
   - If issues persist, check Supabase project settings

6. **Test from Supabase Dashboard:**
   - Go to Storage → `profile-images`
   - Try uploading a file manually
   - If this works, the issue is with the app code
   - If this fails, the issue is with bucket/policy setup

### Error: "File size exceeds limit"
- **Solution**: Increase file size limit in bucket settings or compress the image
- **Check**: Go to Storage → `profile-images` → Settings → File size limit

### Images not displaying
- **Solution**: 
  1. Verify bucket is **Public** (orange "PUBLIC" tag in bucket list)
  2. Check SELECT policy allows public read
  3. Verify the URL format is correct
  4. Check browser console for 403/404 errors

### Error: "Authentication error" or "JWT"
- **Solution**: 
  1. Log out and log back in
  2. Check that your session is valid
  3. Verify Supabase auth is working (try other auth operations)

## Child Images Bucket Setup

Child photos are stored in a separate bucket called `child-images`. To set it up:

1. **Run the SQL script**: `CREATE_CHILD_IMAGES_BUCKET.sql`
   - This creates the `child-images` bucket
   - Sets up RLS policies for child image uploads
   - Allows parents to upload photos for their children

2. **Path format**: `childImages/{userId}/{childId}_{timestamp}.jpg`
   - Files are organized by parent user ID
   - Each child photo has a unique filename with timestamp

3. **Verify setup**:
   - Go to Storage → `child-images` in Supabase Dashboard
   - Check that the bucket exists and is public
   - Verify 4 policies are active (INSERT, UPDATE, SELECT, DELETE)

## 📝 Notes

- **Profile Bucket Name**: Must be `profile-images` (with hyphen, lowercase)
- **Child Images Bucket Name**: Must be `child-images` (with hyphen, lowercase)
- **Profile Path Format**: Files are stored as `{user_id}/{timestamp}.jpg`
- **Child Path Format**: Files are stored as `{user_id}/{childId}_{timestamp}.jpg`
- **Public Access**: Required for images to display in the app
- **File Size**: 5MB limit is recommended for profile pictures

## 🔒 Security Notes

- Users can only upload/update/delete files in their own folder (`{user_id}/`)
- Public read access is required for images to display
- Consider adding MIME type restrictions for additional security
- File size limits prevent abuse
