/**
 * Admin Creation Script for Supabase
 * 
 * IMPORTANT: This script requires ts-node to be installed
 * Install: npm install --save-dev ts-node
 * 
 * Usage:
 * 1. Make sure your Supabase credentials are in .env or app.config.js
 * 2. Update ADMIN_EMAIL and ADMIN_PASSWORD below
 * 3. Run: npx ts-node scripts/createAdmin.ts
 * 
 * Alternative: Use Supabase Dashboard method (see below)
 */

import { createClient } from '@supabase/supabase-js';

// ⚠️ UPDATE THESE WITH YOUR SUPABASE CREDENTIALS
// Get these from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// ⚠️ UPDATE THESE WITH YOUR DESIRED ADMIN CREDENTIALS
const ADMIN_EMAIL = 'admin@carelum.com';
const ADMIN_PASSWORD = 'AdminPassword123!';
const ADMIN_DISPLAY_NAME = 'Admin User';

async function createAdmin() {
  try {
    console.log('🚀 Starting admin creation...\n');

    if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      throw new Error('Please set EXPO_PUBLIC_SUPABASE_URL in .env or update SUPABASE_URL in this script');
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      throw new Error('Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env or update SUPABASE_ANON_KEY in this script');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('📧 Creating auth user...');
    // 1. Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('\n💡 This email is already registered.');
        console.log('   Option 1: Use a different email');
        console.log('   Option 2: Change existing user role to admin in Supabase Dashboard');
        console.log('   Option 3: Delete the existing user and run this script again\n');
        throw authError;
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user');
    }

    const userId = authData.user.id;
    console.log('✅ Auth user created:', userId);

    console.log('👤 Creating user profile with admin role...');
    
    // 2. Generate user number (admin numbers start with 'a1', 'a2', etc.)
    const { data: existingAdmins } = await supabase
      .from('users')
      .select('user_number')
      .eq('role', 'admin')
      .not('user_number', 'is', null)
      .order('user_number', { ascending: false })
      .limit(1);

    let userNumber = 'a1';
    if (existingAdmins && existingAdmins.length > 0) {
      const lastNumber = existingAdmins[0].user_number;
      if (lastNumber && lastNumber.startsWith('a')) {
        const num = parseInt(lastNumber.substring(1)) || 0;
        userNumber = `a${num + 1}`;
      }
    }

    // 3. Create user profile with admin role using RPC function (bypasses RLS)
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_id: userId,
      p_email: ADMIN_EMAIL,
      p_display_name: ADMIN_DISPLAY_NAME,
      p_role: 'admin',
      p_preferred_language: 'en',
      p_user_number: userNumber,
      p_phone_number: null,
      p_photo_url: null,
      p_theme: 'auto',
      p_is_verified: false,
      p_verification_status: null,
      p_hourly_rate: null,
      p_bio: null,
    });

    // If RPC fails, try direct upsert
    if (rpcError) {
      console.warn('⚠️ RPC function failed, trying direct upsert:', rpcError.message);
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: ADMIN_EMAIL,
          display_name: ADMIN_DISPLAY_NAME,
          role: 'admin',
          preferred_language: 'en',
          user_number: userNumber,
          phone_number: null,
          photo_url: null,
          theme: 'auto',
          is_verified: false,
          verification_status: null,
          hourly_rate: null,
          bio: null,
        }, { onConflict: 'id' });

      if (upsertError) {
        throw upsertError;
      }
    }

    console.log('✅ User profile created with admin role\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Display Name:', ADMIN_DISPLAY_NAME);
    console.log('🔐 Role: admin');
    console.log('🔢 User Number:', userNumber);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT: Save these credentials securely!');
    console.log('⚠️  You can now login to the app with these credentials.\n');
    console.log('📝 Note: If email confirmation is enabled in Supabase,');
    console.log('   you may need to confirm the email before logging in.\n');
    console.log('   To disable: Supabase Dashboard → Authentication → Settings');
    console.log('   → Disable "Enable email confirmations"\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin:', error.message);
    console.error('   Error details:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Run the script
createAdmin();
