#!/usr/bin/env python3
"""
Test Supabase connection directly
Helps diagnose connection issues
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

print("=" * 60)
print("Supabase Connection Test")
print("=" * 60)
print()

print(f"SUPABASE_URL: {SUPABASE_URL[:50]}..." if SUPABASE_URL else "❌ SUPABASE_URL not set")
print(f"SUPABASE_ANON_KEY: {SUPABASE_ANON_KEY[:50]}..." if SUPABASE_ANON_KEY else "❌ SUPABASE_ANON_KEY not set")
print(f"Key length: {len(SUPABASE_ANON_KEY)} characters" if SUPABASE_ANON_KEY else "")
print()

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Missing credentials in backend/.env")
    print("   Add SUPABASE_URL and SUPABASE_ANON_KEY")
    sys.exit(1)

# Check key format
if SUPABASE_ANON_KEY.startswith("sb_publishable_"):
    print("❌ ERROR: Key starts with 'sb_publishable_'")
    print("   This is NOT a valid Supabase anon key!")
    print("   Get the 'anon public' key from Supabase Dashboard → Settings → API")
    sys.exit(1)

if len(SUPABASE_ANON_KEY) < 50:
    print("⚠️  WARNING: Key seems too short")
    print("   Anon keys are usually 100+ characters")
    print()

# Try to connect
print("Attempting to connect to Supabase...")
try:
    from supabase import create_client
    
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    # Try a simple query
    print("✅ Supabase client created successfully")
    print("Testing connection with a simple query...")
    
    # Try to query users table (this will fail if RLS blocks it, but connection should work)
    try:
        result = supabase.table("users").select("id").limit(1).execute()
        print("✅ Connection successful! Can query database")
    except Exception as query_error:
        error_msg = str(query_error)
        if "Invalid API key" in error_msg or "invalid" in error_msg.lower():
            print("❌ Connection failed: Invalid API key")
            print()
            print("SOLUTION:")
            print("1. Go to Supabase Dashboard → Settings → API")
            print("2. Copy the 'anon public' key (NOT 'publishable')")
            print("3. Update backend/.env with the correct key")
            sys.exit(1)
        elif "permission" in error_msg.lower() or "policy" in error_msg.lower():
            print("✅ Connection successful! (RLS policy blocking query is normal)")
        else:
            print(f"⚠️  Query failed: {error_msg}")
            print("   But connection to Supabase works")
    
except ImportError:
    print("❌ supabase package not installed")
    print("   Install with: pip install supabase")
    sys.exit(1)
except Exception as e:
    error_msg = str(e)
    print(f"❌ Connection failed: {error_msg}")
    
    if "Invalid API key" in error_msg or "invalid" in error_msg.lower():
        print()
        print("SOLUTION:")
        print("1. Go to Supabase Dashboard → Settings → API")
        print("2. Find 'anon public' key (NOT 'publishable' or 'service_role')")
        print("3. Copy the ENTIRE key (it's very long, 100+ characters)")
        print("4. Update backend/.env:")
        print("   SUPABASE_ANON_KEY=your_correct_key_here")
        print()
        print("The key should:")
        print("  ✓ Be 100+ characters long")
        print("  ✓ Look like base64 (usually starts with 'eyJ...')")
        print("  ✗ NOT start with 'sb_publishable_'")
    elif "network" in error_msg.lower() or "connection" in error_msg.lower():
        print()
        print("SOLUTION:")
        print("1. Check your internet connection")
        print("2. Verify SUPABASE_URL is correct")
        print("3. Check if Supabase project is active (not paused)")
    
    sys.exit(1)

print()
print("=" * 60)
print("✅ All checks passed!")
print("=" * 60)
print()
print("Your backend should now connect successfully.")
print("Restart the backend server to apply changes.")
