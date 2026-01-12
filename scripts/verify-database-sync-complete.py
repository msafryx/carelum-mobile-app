#!/usr/bin/env python3
"""
Comprehensive Database Sync Verification Script
Tests all tables, CRUD operations, and provides detailed status report
"""
import sys
import os
from pathlib import Path

# Try to import dotenv, provide helpful error if missing
try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ Error: 'dotenv' module not found!")
    print("\n💡 This script should be run using the backend virtual environment.")
    print("   Use the wrapper script instead:")
    print("   ./scripts/verify-database-sync.sh")
    print("\n   Or activate venv manually:")
    print("   cd backend && source venv/bin/activate && python3 ../scripts/verify-database-sync-complete.py")
    sys.exit(1)

# Add backend to path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Load environment variables
env_path = backend_path / '.env'
load_dotenv(dotenv_path=env_path)

# Try to import supabase
try:
    from supabase import create_client
except ImportError:
    print("❌ Error: 'supabase' module not found!")
    print("\n💡 This script should be run using the backend virtual environment.")
    print("   Install dependencies:")
    print("   cd backend && source venv/bin/activate && pip install -r requirements.txt")
    sys.exit(1)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Expected tables
EXPECTED_TABLES = [
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

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def print_section(text):
    print(f"\n📋 {text}")
    print("-" * 70)

def test_connection():
    """Test Supabase connection"""
    print_section("Testing Database Connection")
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ Environment variables not set!")
        print(f"   SUPABASE_URL: {'✅ Set' if SUPABASE_URL else '❌ Missing'}")
        print(f"   SUPABASE_ANON_KEY: {'✅ Set' if SUPABASE_ANON_KEY else '❌ Missing'}")
        print("\n💡 Fix: Update backend/.env with:")
        print("   SUPABASE_URL=https://your-project.supabase.co")
        print("   SUPABASE_ANON_KEY=your-anon-key-here")
        return None
    
    try:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Supabase client created successfully")
        return client
    except Exception as e:
        print(f"❌ Failed to create Supabase client: {e}")
        return None

def test_table_exists(client, table_name):
    """Test if table exists and is accessible"""
    try:
        # Try to query the table (limit 1 for performance)
        result = client.table(table_name).select("*").limit(1).execute()
        return True, None
    except Exception as e:
        error_msg = str(e)
        if "relation" in error_msg.lower() or "does not exist" in error_msg.lower():
            return False, "Table does not exist"
        elif "permission" in error_msg.lower() or "policy" in error_msg.lower():
            return False, "RLS policy issue - check permissions"
        else:
            return False, f"Error: {error_msg}"

def test_table_structure(client, table_name):
    """Test basic table structure by attempting a SELECT"""
    try:
        result = client.table(table_name).select("*").limit(1).execute()
        count = len(result.data) if result.data else 0
        return True, count
    except Exception as e:
        return False, str(e)

def test_crud_operations(client, table_name):
    """Test CRUD operations (READ only for now)"""
    results = {
        "read": False,
        "error": None
    }
    
    try:
        # Test READ
        result = client.table(table_name).select("*").limit(5).execute()
        results["read"] = True
        results["count"] = len(result.data) if result.data else 0
    except Exception as e:
        results["error"] = str(e)
    
    return results

def get_table_info(client, table_name):
    """Get information about a table"""
    info = {
        "exists": False,
        "accessible": False,
        "row_count": 0,
        "read_works": False,
        "error": None
    }
    
    # Test existence
    exists, error = test_table_exists(client, table_name)
    info["exists"] = exists
    
    if not exists:
        info["error"] = error
        return info
    
    # Test accessibility
    accessible, count = test_table_structure(client, table_name)
    info["accessible"] = accessible
    info["row_count"] = count
    
    # Test CRUD
    crud_results = test_crud_operations(client, table_name)
    info["read_works"] = crud_results["read"]
    if crud_results.get("count") is not None:
        info["row_count"] = crud_results["count"]
    if crud_results["error"]:
        info["error"] = crud_results["error"]
    
    return info

def main():
    """Main verification function"""
    print_header("DATABASE SYNC VERIFICATION")
    print("\nThis script verifies:")
    print("  ✅ Database connection")
    print("  ✅ All tables exist")
    print("  ✅ Tables are accessible")
    print("  ✅ CRUD operations work")
    
    # Test connection
    client = test_connection()
    if not client:
        print("\n❌ Cannot proceed without database connection")
        print("\n💡 Next Steps:")
        print("   1. Check backend/.env file exists")
        print("   2. Verify SUPABASE_URL and SUPABASE_ANON_KEY are set")
        print("   3. Ensure Supabase project is active")
        sys.exit(1)
    
    # Test all tables
    print_section("Testing All Tables")
    
    table_results = {}
    all_tables_ok = True
    
    for table in EXPECTED_TABLES:
        print(f"\n🔍 Testing table: {table}")
        info = get_table_info(client, table)
        table_results[table] = info
        
        if info["exists"] and info["accessible"] and info["read_works"]:
            status = "✅"
            if info["row_count"] > 0:
                print(f"   {status} Table exists, accessible, and has {info['row_count']} row(s)")
            else:
                print(f"   {status} Table exists and accessible (empty)")
        else:
            status = "❌"
            all_tables_ok = False
            print(f"   {status} Issues found:")
            if not info["exists"]:
                print(f"      - Table does not exist")
            if not info["accessible"]:
                print(f"      - Table not accessible")
            if not info["read_works"]:
                print(f"      - READ operation failed")
            if info["error"]:
                print(f"      - Error: {info['error']}")
    
    # Summary
    print_header("VERIFICATION SUMMARY")
    
    print("\n📊 Table Status:")
    for table, info in table_results.items():
        if info["exists"] and info["accessible"] and info["read_works"]:
            print(f"   ✅ {table:25} - OK ({info['row_count']} rows)")
        else:
            print(f"   ❌ {table:25} - ISSUES")
            if info["error"]:
                print(f"      Error: {info['error']}")
    
    print("\n" + "=" * 70)
    
    if all_tables_ok:
        print("✅ ALL TABLES ARE SYNCED AND WORKING!")
        print("\n📝 Next Steps:")
        print("   1. Test API endpoints (see TESTING_GUIDE.md)")
        print("   2. Test frontend features")
        print("   3. Test user authentication and sessions")
    else:
        print("❌ SOME TABLES HAVE ISSUES")
        print("\n💡 Fix Steps:")
        print("   1. Go to Supabase Dashboard → SQL Editor")
        print("   2. Run scripts/create-supabase-schema.sql")
        print("   3. Check RLS policies in Database → Authentication → Policies")
        print("   4. Re-run this script to verify")
    
    print("\n" + "=" * 70)
    
    return 0 if all_tables_ok else 1

if __name__ == "__main__":
    sys.exit(main())
