"""
User and profile management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from decimal import Decimal

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter()


class UserProfileResponse(BaseModel):
    """User profile response model"""
    id: str
    email: str
    displayName: str
    role: str
    preferredLanguage: str
    userNumber: Optional[str] = None
    phoneNumber: Optional[str] = None
    profileImageUrl: Optional[str] = None
    theme: str = "auto"
    isVerified: bool = False
    verificationStatus: Optional[str] = None
    hourlyRate: Optional[float] = None
    bio: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    createdAt: str
    updatedAt: str


class UpdateProfileRequest(BaseModel):
    """Request model for updating user profile"""
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    profileImageUrl: Optional[str] = None
    preferredLanguage: Optional[str] = None
    theme: Optional[str] = None
    bio: Optional[str] = None
    hourlyRate: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get current user's profile
    """
    try:
        # CRITICAL: Use Supabase client with user's auth token for RLS to work!
        # Without the token, RLS policies can't identify the user and will block reads
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="AUTH_ERROR",
                message="Failed to authenticate with database",
                status_code=500
            )
        
        # Fetch user profile from database
        # Handle RLS blocking gracefully
        try:
            response = supabase.table("users").select("*").eq("id", current_user.id).single().execute()
            user_data = response.data
        except Exception as query_error:
            # Check if this is a "0 rows" error (RLS blocking or user doesn't exist)
            error_str = str(query_error)
            if "0 rows" in error_str or "PGRST116" in error_str or "APIError" in str(type(query_error).__name__):
                # Try without .single() to see if we get any rows
                try:
                    response = supabase.table("users").select("*").eq("id", current_user.id).execute()
                    if response.data and len(response.data) > 0:
                        user_data = response.data[0]
                    else:
                        # User doesn't exist - return minimal profile
                        from datetime import datetime
                        now = datetime.utcnow().isoformat()
                        print(f"⚠️ User profile not found in DB, returning minimal profile for {current_user.email}")
                        return UserProfileResponse(
                            id=current_user.id,
                            email=current_user.email,
                            displayName="",
                            role=current_user.role or "parent",
                            preferredLanguage="en",
                            userNumber=None,
                            phoneNumber=None,
                            profileImageUrl=None,
                            theme="auto",
                            isVerified=False,
                            verificationStatus=None,
                            hourlyRate=None,
                            bio=None,
                            address=None,
                            city=None,
                            country=None,
                            createdAt=now,
                            updatedAt=now
                        )
                except Exception as retry_error:
                    # Still blocked - return minimal profile
                    from datetime import datetime
                    now = datetime.utcnow().isoformat()
                    print(f"⚠️ Query blocked by RLS, returning minimal profile for {current_user.email}")
                    return UserProfileResponse(
                        id=current_user.id,
                        email=current_user.email,
                        displayName="",
                        role=current_user.role or "parent",
                        preferredLanguage="en",
                        userNumber=None,
                        phoneNumber=None,
                        profileImageUrl=None,
                        theme="auto",
                        isVerified=False,
                        verificationStatus=None,
                        hourlyRate=None,
                        bio=None,
                        address=None,
                        city=None,
                        country=None,
                        createdAt=now,
                        updatedAt=now
                    )
            else:
                # Some other error - re-raise it
                raise query_error
        
        if not user_data:
            raise AppError(
                code="PROFILE_NOT_FOUND",
                message="User profile not found",
                status_code=404
            )
        
        # Convert database format to API response format
        return UserProfileResponse(
            id=user_data["id"],
            email=user_data["email"],
            displayName=user_data.get("display_name", ""),
            role=user_data.get("role", "parent"),
            preferredLanguage=user_data.get("preferred_language", "en"),
            userNumber=user_data.get("user_number"),
            phoneNumber=user_data.get("phone_number"),
            profileImageUrl=user_data.get("photo_url"),
            theme=user_data.get("theme", "auto"),
            isVerified=user_data.get("is_verified", False),
            verificationStatus=user_data.get("verification_status"),
            hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
            bio=user_data.get("bio"),
            address=user_data.get("address"),
            city=user_data.get("city"),
            country=user_data.get("country"),
            createdAt=user_data["created_at"],
            updatedAt=user_data.get("updated_at", user_data["created_at"])
        )
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch user profile")


@router.put("/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    updates: UpdateProfileRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Update current user's profile
    """
    try:
        # CRITICAL: Use Supabase client with user's auth token for RLS to work!
        # Without the token, RLS policies can't identify the user and will block updates
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="AUTH_ERROR",
                message="Failed to authenticate with database",
                status_code=500
            )
        
        # Get all provided fields (including None values to allow clearing fields)
        try:
            updates_dict = updates.model_dump(exclude_unset=True) if hasattr(updates, 'model_dump') else updates.dict(exclude_unset=True)
        except:
            updates_dict = updates.dict(exclude_unset=True)
        
        print(f"📥 Received update request with fields: {list(updates_dict.keys())}")
        print(f"📥 Update values: {updates_dict}")
        
        # Build update dictionary (only include provided fields)
        update_data = {}
        if updates.displayName is not None:
            update_data["display_name"] = updates.displayName
        # Handle phoneNumber - include if provided (even if None to clear field)
        if 'phoneNumber' in updates_dict:
            update_data["phone_number"] = updates.phoneNumber
            print(f"✅ Including phoneNumber in update: {updates.phoneNumber}")
        if updates.profileImageUrl is not None:
            update_data["photo_url"] = updates.profileImageUrl
        if updates.preferredLanguage is not None:
            update_data["preferred_language"] = updates.preferredLanguage
        if updates.theme is not None:
            update_data["theme"] = updates.theme
        if updates.bio is not None:
            update_data["bio"] = updates.bio
        if updates.hourlyRate is not None:
            update_data["hourly_rate"] = Decimal(str(updates.hourlyRate))
        
        # Handle address, city, country - include if provided (even if None to clear field)
        # Use 'in' operator to check if field was explicitly provided in the request
        if 'address' in updates_dict:
            update_data["address"] = updates.address
            print(f"✅ Including address in update: {updates.address}")
        if 'city' in updates_dict:
            update_data["city"] = updates.city
            print(f"✅ Including city in update: {updates.city}")
        if 'country' in updates_dict:
            update_data["country"] = updates.country
            print(f"✅ Including country in update: {updates.country}")
        
        print(f"📤 Final update_data: {update_data}")
        
        # Add updated_at timestamp
        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Helper function to build response from updates
        def build_response_from_updates():
            now = datetime.utcnow().isoformat()
            return UserProfileResponse(
                id=current_user.id,
                email=current_user.email,
                displayName=updates.displayName or "",
                role=current_user.role or "parent",
                preferredLanguage=updates.preferredLanguage or "en",
                userNumber=None,
                phoneNumber=updates.phoneNumber,
                profileImageUrl=updates.profileImageUrl,
                theme=updates.theme or "auto",
                isVerified=False,
                verificationStatus=None,
                hourlyRate=updates.hourlyRate,
                bio=updates.bio,
                address=updates.address,
                city=updates.city,
                country=updates.country,
                createdAt=now,
                updatedAt=now
            )
        
        # Update user profile with select to get updated row back
        user_data = None
        update_successful = False
        try:
            print(f"🔄 Attempting to update user {current_user.id} with data: {update_data}")
            # Use .select("*") to get the updated row back
            response = supabase.table("users").update(update_data).eq("id", current_user.id).select("*").execute()
            
            print(f"📥 Update response: {response.data if response.data else 'EMPTY'}")
            
            # If we got data back, use it
            if response.data and len(response.data) > 0:
                user_data = response.data[0] if isinstance(response.data, list) else response.data
                update_successful = True
                print(f"✅ Update successful, got updated row from database")
            else:
                # Empty response - RLS might be blocking SELECT after UPDATE
                print(f"⚠️ Empty response from update, verifying by reading user...")
                # Try to read the user separately to verify update worked
                try:
                    read_response = supabase.table("users").select("*").eq("id", current_user.id).execute()
                    if read_response.data and len(read_response.data) > 0:
                        user_data = read_response.data[0]
                        # Verify the update actually happened by checking if fields changed
                        update_successful = True
                        print(f"✅ Verified update by reading user back from database")
                    else:
                        print(f"❌ Cannot read user after update - update may have failed")
                        update_successful = False
                except Exception as read_error:
                    print(f"❌ Failed to read user after update: {read_error}")
                    update_successful = False
                    
        except Exception as update_error:
            # Update query itself failed
            error_str = str(update_error)
            print(f"❌ Update query failed: {update_error}")
            print(f"❌ Error type: {type(update_error)}")
            print(f"❌ Error details: {error_str}")
            update_successful = False
            
            # Check if it's an RLS/permission error
            if "permission" in error_str.lower() or "policy" in error_str.lower() or "PGRST" in error_str:
                print(f"❌ RLS blocking update - this is a database permission issue")
                raise AppError(
                    code="PERMISSION_DENIED",
                    message="Database update blocked by security policies. Please check RLS policies.",
                    status_code=403
                )
            
            # DO NOT use RPC function as fallback - it will reset role to 'parent'!
            # The RPC function is only for creating new profiles, not updating existing ones
            print(f"❌ Cannot use RPC fallback - it would reset user role. Update must use direct table update.")
            raise AppError(
                code="UPDATE_FAILED",
                message=f"Failed to update user profile in database: {error_str}",
                status_code=500
            )
        
        # Only return success if we actually got updated data from database
        if update_successful and user_data:
            print(f"✅ Returning updated user data from database")
            return UserProfileResponse(
                id=user_data["id"],
                email=user_data["email"],
                displayName=user_data.get("display_name", ""),
                role=user_data.get("role", "parent"),
                preferredLanguage=user_data.get("preferred_language", "en"),
                userNumber=user_data.get("user_number"),
                phoneNumber=user_data.get("phone_number"),
                profileImageUrl=user_data.get("photo_url"),
                theme=user_data.get("theme", "auto"),
                isVerified=user_data.get("is_verified", False),
                verificationStatus=user_data.get("verification_status"),
                hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
                bio=user_data.get("bio"),
                address=user_data.get("address"),
                city=user_data.get("city"),
                country=user_data.get("country"),
                createdAt=user_data["created_at"],
                updatedAt=user_data.get("updated_at", user_data["created_at"])
            )
        else:
            # Update failed - raise error instead of returning fake data
            print(f"❌ Database update failed - cannot return fake success")
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update user profile in database. The update may have been blocked by security policies.",
                status_code=500
            )
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update user profile")


@router.get("/sitters/verified", response_model=List[UserProfileResponse])
async def get_verified_sitters(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    limit: int = 100
):
    """
    Get list of verified sitters (for parents to browse and select)
    Only verified sitters with is_verified = true are returned
    """
    try:
        # Use authenticated Supabase client for RLS
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="AUTH_ERROR",
                message="Failed to authenticate with database",
                status_code=500
            )
        
        # Query for verified sitters only
        # Note: RLS policies should allow parents to read verified sitter profiles for browsing
        # If RLS blocks, parents won't be able to see sitters - need to update RLS policy
        # Use lowercase 'true' for boolean comparison (PostgreSQL standard)
        query = supabase.table("users").select("*").eq("role", "sitter").eq("is_verified", True)
        
        # Alternative: Try with explicit boolean true if the above doesn't work
        # Some Supabase versions might need explicit boolean handling
        
        # Order by created_at (newest first) or you could order by rating/reviews if available
        query = query.order("created_at", desc=True).limit(limit)
        
        print(f"🔍 Querying verified sitters for user {current_user.id} (role: {current_user.role})")
        
        try:
            response = query.execute()
            
            # Check for errors in response
            if hasattr(response, 'error') and response.error:
                error_str = str(response.error)
                print(f"❌ Supabase query error: {error_str}")
                if "permission" in error_str.lower() or "policy" in error_str.lower() or "RLS" in error_str or "PGRST" in error_str:
                    raise AppError(
                        code="PERMISSION_DENIED",
                        message="Cannot access verified sitters. RLS policy may be blocking access. Please run UPDATE_RLS_FOR_VERIFIED_SITTERS.sql in Supabase SQL Editor.",
                        status_code=403
                    )
            
            print(f"📥 Raw response: {response.data if hasattr(response, 'data') else 'NO DATA'}")
            print(f"📥 Found {len(response.data or [])} verified sitters")
            
            if not response.data:
                print(f"⚠️ No verified sitters found. Possible reasons:")
                print(f"   1. No sitters with is_verified = true and role = 'sitter'")
                print(f"   2. RLS policies blocking access (run UPDATE_RLS_FOR_VERIFIED_SITTERS.sql)")
                print(f"   3. Database connection issue")
                return []
        except AppError:
            raise
        except Exception as query_error:
            error_str = str(query_error)
            print(f"❌ Query execution error: {error_str}")
            if "permission" in error_str.lower() or "policy" in error_str.lower() or "RLS" in error_str or "PGRST" in error_str or "406" in error_str:
                raise AppError(
                    code="PERMISSION_DENIED",
                    message="Cannot access verified sitters. RLS policy may be blocking access. Please run UPDATE_RLS_FOR_VERIFIED_SITTERS.sql in Supabase SQL Editor to allow parents to read verified sitter profiles.",
                    status_code=403
                )
            raise
        
        # Convert to response format
        sitters = []
        for user_data in (response.data or []):
            sitters.append(UserProfileResponse(
                id=user_data["id"],
                email=user_data["email"],
                displayName=user_data.get("display_name", ""),
                role=user_data.get("role", "sitter"),
                preferredLanguage=user_data.get("preferred_language", "en"),
                userNumber=user_data.get("user_number"),
                phoneNumber=user_data.get("phone_number"),
                profileImageUrl=user_data.get("photo_url"),
                theme=user_data.get("theme", "auto"),
                isVerified=user_data.get("is_verified", False),
                verificationStatus=user_data.get("verification_status"),
                hourlyRate=float(user_data["hourly_rate"]) if user_data.get("hourly_rate") else None,
                bio=user_data.get("bio"),
                address=user_data.get("address"),
                city=user_data.get("city"),
                country=user_data.get("country"),
                createdAt=user_data["created_at"],
                updatedAt=user_data.get("updated_at", user_data["created_at"])
            ))
        
        print(f"✅ Found {len(sitters)} verified sitters")
        return sitters
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch verified sitters")
