"""
Database connection utilities
"""
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Global Supabase client (without auth token - for admin operations)
_supabase: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """Get or initialize Supabase client (without user auth token)"""
    global _supabase
    
    if _supabase is None:
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
        
        if SUPABASE_URL and SUPABASE_ANON_KEY:
            try:
                _supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
            except Exception as e:
                print(f"Failed to initialize Supabase client: {e}")
                return None
    
    return _supabase


def get_supabase_with_auth(auth_token: str) -> Optional[Client]:
    """
    Get Supabase client with user's auth token for RLS policies
    This is CRITICAL for RLS to work - auth.uid() needs the token!
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ Supabase credentials not found")
        return None
    
    try:
        # Create a new client
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        
        # CRITICAL: Set the auth token using the auth.set_session method
        # This properly configures the client for RLS policies
        try:
            # Use set_session to set the access token
            # This is the correct way to authenticate the client for RLS
            client.auth.set_session(access_token=auth_token, refresh_token="")
            print(f"✅ Set auth token using set_session for RLS")
        except Exception as auth_error:
            # Fallback: Set headers directly if set_session fails
            print(f"⚠️ set_session failed, trying direct header method: {auth_error}")
            if hasattr(client, 'postgrest'):
                # Set Authorization header for RLS to work
                client.postgrest.headers["Authorization"] = f"Bearer {auth_token}"
                client.postgrest.headers["apikey"] = SUPABASE_ANON_KEY
                print(f"✅ Set auth token in postgrest headers for RLS (fallback)")
            else:
                print(f"⚠️ Warning: postgrest client not found, RLS may not work")
        
        return client
    except Exception as e:
        print(f"❌ Failed to create Supabase client with auth token: {e}")
        import traceback
        traceback.print_exc()
        return None


def init_supabase(url: str, key: str) -> Client:
    """Initialize Supabase client with provided credentials"""
    global _supabase
    _supabase = create_client(url, key)
    return _supabase
