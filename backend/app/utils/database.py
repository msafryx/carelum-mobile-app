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

# Global Supabase client
_supabase: Optional[Client] = None


def get_supabase() -> Optional[Client]:
    """Get or initialize Supabase client"""
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


def init_supabase(url: str, key: str) -> Client:
    """Initialize Supabase client with provided credentials"""
    global _supabase
    _supabase = create_client(url, key)
    return _supabase
