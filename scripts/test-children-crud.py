#!/usr/bin/env python3
"""
Test Children CRUD Operations
Tests create, read, update, delete operations for children table
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import uuid
from datetime import datetime, date

# Add backend to path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Load environment variables
env_path = backend_path / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def print_section(text):
    print(f"\n📋 {text}")
    print("-" * 70)

def test_children_table_exists(client):
    """Test if children table exists and is accessible"""
    print_section("Testing Children Table Access")
    
    try:
        result = client.table('children').select('*').limit(1).execute()
        print("✅ Children table exists and is accessible")
        print(f"   Current row count: {len(result.data) if result.data else 0}")
        return True
    except Exception as e:
        print(f"❌ Error accessing children table: {e}")
        return False

def test_create_child(client, parent_id):
    """Test CREATE operation"""
    print_section("Testing CREATE Child")
    
    test_child = {
        "parent_id": parent_id,
        "name": f"Test Child {datetime.now().strftime('%H%M%S')}",
        "age": 5,
        "date_of_birth": "2019-01-15",
        "gender": "male",
        "child_number": f"c{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "parent_number": "p1"
    }
    
    print(f"🧪 Creating child:")
    print(f"   Name: {test_child['name']}")
    print(f"   Age: {test_child['age']}")
    print(f"   Parent ID: {parent_id}")
    
    try:
        result = client.table('children').insert(test_child).select().execute()
        
        if result.data and len(result.data) > 0:
            child_id = result.data[0]['id']
            print(f"✅ Child created successfully!")
            print(f"   Child ID: {child_id}")
            print(f"   Name: {result.data[0].get('name')}")
            return True, child_id
        else:
            print("❌ Child creation returned no data")
            return False, None
    except Exception as e:
        error_msg = str(e)
        if 'permission' in error_msg.lower() or 'policy' in error_msg.lower():
            print(f"❌ Permission denied - RLS policy issue: {error_msg}")
        else:
            print(f"❌ Error creating child: {error_msg}")
        return False, None

def test_read_child(client, child_id):
    """Test READ operation"""
    print_section("Testing READ Child")
    
    try:
        result = client.table('children').select('*').eq('id', child_id).execute()
        
        if result.data and len(result.data) > 0:
            child = result.data[0]
            print("✅ Child read successfully!")
            print(f"   ID: {child.get('id')}")
            print(f"   Name: {child.get('name')}")
            print(f"   Age: {child.get('age')}")
            print(f"   Parent ID: {child.get('parent_id')}")
            return True
        else:
            print("❌ Child not found")
            return False
    except Exception as e:
        print(f"❌ Error reading child: {e}")
        return False

def test_update_child(client, child_id):
    """Test UPDATE operation"""
    print_section("Testing UPDATE Child")
    
    updates = {
        "name": f"Updated Child {datetime.now().strftime('%H%M%S')}",
        "age": 6
    }
    
    print(f"🧪 Updating child:")
    print(f"   New name: {updates['name']}")
    print(f"   New age: {updates['age']}")
    
    try:
        result = client.table('children').update(updates).eq('id', child_id).select().execute()
        
        if result.data and len(result.data) > 0:
            child = result.data[0]
            print("✅ Child updated successfully!")
            print(f"   Updated name: {child.get('name')}")
            print(f"   Updated age: {child.get('age')}")
            return True
        else:
            print("❌ Update returned no data")
            return False
    except Exception as e:
        error_msg = str(e)
        if 'permission' in error_msg.lower() or 'policy' in error_msg.lower():
            print(f"❌ Permission denied - RLS policy issue: {error_msg}")
        else:
            print(f"❌ Error updating child: {e}")
        return False

def test_list_children(client, parent_id):
    """Test LIST children for a parent"""
    print_section("Testing LIST Children")
    
    try:
        result = client.table('children').select('*').eq('parent_id', parent_id).execute()
        
        count = len(result.data) if result.data else 0
        print(f"✅ Found {count} child(ren) for parent {parent_id}")
        
        if result.data:
            for i, child in enumerate(result.data[:5], 1):  # Show first 5
                print(f"   {i}. {child.get('name')} (Age: {child.get('age')}, ID: {str(child.get('id'))[:8]}...)")
        
        return True
    except Exception as e:
        print(f"❌ Error listing children: {e}")
        return False

def test_delete_child(client, child_id):
    """Test DELETE operation"""
    print_section("Testing DELETE Child")
    
    print(f"🧪 Deleting child: {child_id}")
    
    try:
        result = client.table('children').delete().eq('id', child_id).execute()
        print("✅ Child deleted successfully!")
        return True
    except Exception as e:
        error_msg = str(e)
        if 'permission' in error_msg.lower() or 'policy' in error_msg.lower():
            print(f"❌ Permission denied - RLS policy issue: {error_msg}")
        else:
            print(f"❌ Error deleting child: {e}")
        return False

def get_test_parent_id(client):
    """Get or create a test parent user"""
    print_section("Getting Test Parent User")
    
    try:
        # Try to find an existing parent user
        result = client.table('users').select('id, email, display_name').eq('role', 'parent').limit(1).execute()
        
        if result.data and len(result.data) > 0:
            parent = result.data[0]
            parent_id = parent['id']
            email = parent.get('email', 'N/A')
            name = parent.get('display_name', 'N/A')
            print(f"✅ Using existing parent:")
            print(f"   ID: {parent_id}")
            print(f"   Email: {email}")
            print(f"   Name: {name}")
            return parent_id
        else:
            print("⚠️  No parent users found")
            print("\n💡 To test children CRUD:")
            print("   1. Register a parent user in the app first")
            print("   2. Then re-run this test script")
            print("\n   OR")
            print("   3. Create a test parent in Supabase Dashboard → Table Editor → users")
            print("      - role: 'parent'")
            print("      - email: 'test@example.com'")
            print("      - display_name: 'Test Parent'")
            return None
    except Exception as e:
        error_msg = str(e)
        if 'infinite recursion' in error_msg.lower():
            print("❌ Infinite recursion detected in RLS policies")
            print("   Run scripts/COMPLETE_DATABASE_SETUP.sql to fix")
        else:
            print(f"❌ Error finding parent user: {e}")
        return None

def main():
    """Main test function"""
    print_header("CHILDREN CRUD OPERATIONS TEST")
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ Environment variables not set!")
        sys.exit(1)
    
    try:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # Test table access
    if not test_children_table_exists(client):
        print("\n❌ Cannot proceed - children table not accessible")
        sys.exit(1)
    
    # Get test parent
    parent_id = get_test_parent_id(client)
    if not parent_id:
        print("\n❌ Cannot proceed - no parent user found")
        print("\n💡 Fix:")
        print("   1. Register a parent user in the app")
        print("   2. Or create a test parent in Supabase Dashboard")
        sys.exit(1)
    
    # Run CRUD tests
    results = []
    
    # CREATE
    create_success, child_id = test_create_child(client, parent_id)
    results.append(("CREATE", create_success))
    
    if not create_success or not child_id:
        print("\n❌ CREATE failed - cannot continue with other tests")
        sys.exit(1)
    
    # READ
    read_success = test_read_child(client, child_id)
    results.append(("READ", read_success))
    
    # LIST
    list_success = test_list_children(client, parent_id)
    results.append(("LIST", list_success))
    
    # UPDATE
    update_success = test_update_child(client, child_id)
    results.append(("UPDATE", update_success))
    
    # DELETE
    delete_success = test_delete_child(client, child_id)
    results.append(("DELETE", delete_success))
    
    # Summary
    print_header("TEST SUMMARY")
    
    print("\n📊 CRUD Operations:")
    for operation, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"   {operation:10} - {status}")
    
    all_passed = all(success for _, success in results)
    
    if all_passed:
        print("\n✅ ALL CRUD OPERATIONS WORKING!")
        print("\n📝 Next Steps:")
        print("   1. Test children CRUD in the app")
        print("   2. Verify children appear in Supabase Dashboard")
        print("   3. Test child instructions CRUD")
    else:
        print("\n❌ SOME OPERATIONS FAILED")
        print("\n💡 Fix Steps:")
        print("   1. Check RLS policies in Supabase Dashboard")
        print("   2. Verify parent user exists and has correct role")
        print("   3. Check backend API endpoints")
        print("   4. Review error messages above")
    
    print("\n" + "=" * 70)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
