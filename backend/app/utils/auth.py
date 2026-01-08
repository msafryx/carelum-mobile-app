"""
Authentication middleware and utilities for Supabase JWT validation
"""
from fastapi import HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import jwt
from jwt import PyJWKClient
import httpx

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Import database utility
from app.utils.database import get_supabase

security = HTTPBearer()


class CurrentUser:
    """Represents the current authenticated user"""
    def __init__(self, user_id: str, email: str, role: Optional[str] = None):
        self.id = user_id
        self.email = email
        self.role = role


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Verify Supabase JWT token and return current user
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "No token provided"
                }
            }
        )
    
    try:
        # Verify token with Supabase
        # Option 1: Use Supabase client to verify (recommended)
        supabase = get_supabase()
        if supabase:
            try:
                # Get user from Supabase using the token
                response = supabase.auth.get_user(token)
                if response.user:
                    # Get user role from database
                    user_data = supabase.table("users").select("role").eq("id", response.user.id).single().execute()
                    role = user_data.data.get("role") if user_data.data else None
                    
                    return CurrentUser(
                        user_id=response.user.id,
                        email=response.user.email or "",
                        role=role
                    )
            except Exception as e:
                print(f"Supabase token verification failed: {e}")
        
        # Option 2: Manual JWT verification (fallback)
        if SUPABASE_JWT_SECRET:
            decoded = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            user_id = decoded.get("sub")
            email = decoded.get("email", "")
            
            # Get user role from database
            role = None
            supabase = get_supabase()
            if supabase and user_id:
                try:
                    user_data = supabase.table("users").select("role").eq("id", user_id).single().execute()
                    role = user_data.data.get("role") if user_data.data else None
                except:
                    pass
            
            return CurrentUser(
                user_id=user_id,
                email=email,
                role=role
            )
        
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Token verification failed"
                }
            }
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "TOKEN_EXPIRED",
                    "message": "Token has expired"
                }
            }
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": f"Invalid token: {str(e)}"
                }
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "AUTH_ERROR",
                    "message": f"Authentication failed: {str(e)}"
                }
            }
        )


async def verify_admin(user: CurrentUser = Depends(verify_token)) -> CurrentUser:
    """
    Verify that the current user is an admin
    """
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail={
                "success": False,
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Admin access required"
                }
            }
        )
    return user
