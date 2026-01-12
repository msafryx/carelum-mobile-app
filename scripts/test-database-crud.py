#!/usr/bin/env python3
"""
Database CRUD Operations Test Script
Tests all CRUD operations for each table to verify database sync
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

# Load environment variables
env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(dotenv_path=env_path)

from app.utils.database import get_supabase

def test_connection():
    """Test Supabase connection"""
    print("🔍 Testing Supabase connection...")
    supabase = get_supabase()
    
    if not supabase:
        print("❌ Failed to connect to Supabase")
        print("   Check SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env")
        return False
    
    print("✅ Connected to Supabase")
    return True, supabase

def test_table_exists(supabase, table_name):
    """Test if a table exists and is accessible"""
    try:
        # Try to query the table (limit 1 to be fast)
        result = supabase.table(table_name).select("*").limit(1).execute()
        print(f"✅ Table '{table_name}' exists and is accessible")
        return True
    except Exception as e:
        print(f"❌ Table '{table_name}' error: {str(e)}")
        return False

def test_users_crud(supabase):
    """Test users table CRUD operations"""
    print("\n📋 Testing Users Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("users").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} users")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    # Note: CREATE/UPDATE/DELETE require authentication
    # These are tested via API endpoints with proper auth
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    
    return True

def test_children_crud(supabase):
    """Test children table CRUD operations"""
    print("\n📋 Testing Children Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("children").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} children")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    return True

def test_sessions_crud(supabase):
    """Test sessions table CRUD operations"""
    print("\n📋 Testing Sessions Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("sessions").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} sessions")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    return True

def test_alerts_crud(supabase):
    """Test alerts table CRUD operations"""
    print("\n📋 Testing Alerts Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("alerts").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} alerts")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    return True

def test_gps_tracking_crud(supabase):
    """Test GPS tracking table CRUD operations"""
    print("\n📋 Testing GPS Tracking Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("gps_tracking").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} GPS records")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    return True

def test_chat_messages_crud(supabase):
    """Test chat messages table CRUD operations"""
    print("\n📋 Testing Chat Messages Table CRUD...")
    
    # Test READ
    try:
        result = supabase.table("chat_messages").select("*").limit(5).execute()
        print(f"✅ READ: Found {len(result.data)} messages")
    except Exception as e:
        print(f"❌ READ failed: {str(e)}")
        return False
    
    print("ℹ️  CREATE/UPDATE/DELETE require authentication (test via API)")
    return True

def main():
    """Main test function"""
    print("=" * 60)
    print("Database CRUD Operations Test")
    print("=" * 60)
    
    # Test connection
    connection_result = test_connection()
    if not connection_result:
        sys.exit(1)
    
    success, supabase = connection_result
    
    # Test all tables exist
    print("\n📊 Testing Table Existence...")
    tables = [
        "users",
        "children",
        "child_instructions",
        "sessions",
        "alerts",
        "chat_messages",
        "gps_tracking",
        "verification_requests",
        "reviews"
    ]
    
    all_tables_exist = True
    for table in tables:
        if not test_table_exists(supabase, table):
            all_tables_exist = False
    
    if not all_tables_exist:
        print("\n❌ Some tables are missing or inaccessible")
        print("   Run scripts/create-supabase-schema.sql in Supabase SQL Editor")
        sys.exit(1)
    
    # Test CRUD operations
    results = []
    results.append(test_users_crud(supabase))
    results.append(test_children_crud(supabase))
    results.append(test_sessions_crud(supabase))
    results.append(test_alerts_crud(supabase))
    results.append(test_gps_tracking_crud(supabase))
    results.append(test_chat_messages_crud(supabase))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    if all(results):
        print("✅ All CRUD operations (READ) are working")
        print("\n📝 Next Steps:")
        print("   1. Test CREATE/UPDATE/DELETE via API endpoints with authentication")
        print("   2. Follow COMPREHENSIVE_TESTING_GUIDE.md for full feature testing")
        print("   3. Test via app UI to verify AsyncStorage sync")
    else:
        print("❌ Some CRUD operations failed")
        print("   Check Supabase connection and RLS policies")
        sys.exit(1)

if __name__ == "__main__":
    main()
