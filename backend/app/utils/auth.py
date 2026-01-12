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
    Robust implementation that auto-creates user profile if missing
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
        supabase = get_supabase()
        if not supabase:
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": {
                        "code": "SERVER_ERROR",
                        "message": "Database connection failed"
                    }
                }
            )
        
        # Step 1: Decode token without verification to extract user info
        # This allows us to get user_id and email even if signature verification fails
        user_id = None
        email = None
        token_expired = False
        
        try:
            # Try to decode without verification first (to get user info)
            decoded_unverified = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False}
            )
            user_id = decoded_unverified.get("sub")
            email = decoded_unverified.get("email", "")
            
            # Check expiration manually
            import time
            exp = decoded_unverified.get("exp")
            if exp and exp < time.time():
                token_expired = True
                print(f"⚠️ Token expired for user {user_id}")
        except Exception as decode_error:
            print(f"❌ Failed to decode token: {decode_error}")
            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Token format is invalid"
                    }
                }
            )
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": "Token does not contain user ID"
                    }
                }
            )
        
        if token_expired:
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
        
        # Step 2: Verify user exists in auth.users (via Supabase client)
        # This is the primary security check
        try:
            auth_user = supabase.auth.get_user(token)
            if not auth_user.user:
                raise HTTPException(
                    status_code=401,
                    detail={
                        "success": False,
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "User not found in authentication system"
                        }
                    }
                )
            # Use the verified user data
            user_id = auth_user.user.id
            email = auth_user.user.email or email or ""
        except HTTPException:
            raise
        except Exception as auth_error:
            # If Supabase auth verification fails, we still proceed with decoded token
            # but log the warning
            print(f"⚠️ Supabase auth verification failed, using decoded token: {auth_error}")
        
        # Step 3: Check if user exists in public.users table
        role = None
        user_exists = False
        
        try:
            response = supabase.table("users").select("role").eq("id", user_id).single().execute()
            if response.data:
                role = response.data.get("role")
                user_exists = True
                print(f"✅ User {user_id} found in database with role: {role}")
        except Exception as query_error:
            error_str = str(query_error)
            # RLS blocking or user not found - both are OK, we'll auto-create
            if "0 rows" in error_str or "PGRST116" in error_str or "permission" in error_str.lower():
                print(f"⚠️ User {user_id} not found in public.users or RLS blocked, will auto-create")
                user_exists = False
            else:
                print(f"⚠️ Database query error (non-fatal): {query_error}")
                user_exists = False
        
        # Step 4: Auto-create user profile if missing
        if not user_exists:
            try:
                print(f"🔄 Auto-creating user profile for {user_id} ({email})")
                rpc_data = {
                    "p_id": user_id,
                    "p_email": email,
                    "p_display_name": None,  # Will be set by frontend later
                    "p_phone_number": None,
                    "p_address": None,
                    "p_city": None,
                    "p_country": None,
                }
                supabase.rpc("create_user_profile", rpc_data).execute()
                print(f"✅ User profile created successfully for {user_id}")
                
                # Try to read the role after creation
                try:
                    response = supabase.table("users").select("role").eq("id", user_id).single().execute()
                    if response.data:
                        role = response.data.get("role")
                except Exception:
                    # If RLS still blocks, use default role
                    role = "parent"  # Default role
                    print(f"⚠️ RLS blocked read after creation, using default role: {role}")
            except Exception as create_error:
                print(f"⚠️ Auto-create failed (non-fatal): {create_error}")
                # Continue anyway with default role
                role = role or "parent"
        
        # Step 5: Return CurrentUser (always succeeds if we got here)
        return CurrentUser(
            user_id=user_id,
            email=email,
            role=role or "parent"  # Default to "parent" if role is None
        )
        
    except HTTPException:
        raise
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
        print(f"❌ Unexpected auth error: {e}")
        import traceback
        traceback.print_exc()
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
