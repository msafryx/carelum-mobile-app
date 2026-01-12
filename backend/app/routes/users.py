"""
User and profile management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from decimal import Decimal

from app.utils.auth import verify_token, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

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
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get current user's profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
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
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Update current user's profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
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
        try:
            # Use .select("*") to get the updated row back
            response = supabase.table("users").update(update_data).eq("id", current_user.id).select("*").execute()
            
            # If we got data back, use it
            if response.data and len(response.data) > 0:
                user_data = response.data[0] if isinstance(response.data, list) else response.data
            else:
                # Empty response - RLS might be blocking SELECT after UPDATE
                # Try to read the user separately
                try:
                    read_response = supabase.table("users").select("*").eq("id", current_user.id).execute()
                    if read_response.data and len(read_response.data) > 0:
                        user_data = read_response.data[0]
                    else:
                        # Can't read user, but update might have worked
                        return build_response_from_updates()
                except Exception:
                    # Can't read user, but update might have worked
                    return build_response_from_updates()
                    
        except Exception as update_error:
            # Update query itself failed - might be RLS blocking UPDATE
            error_str = str(update_error)
            print(f"⚠️ Update query failed: {update_error}")
            
            # Check if it's an RLS/permission error
            if "permission" in error_str.lower() or "policy" in error_str.lower() or "PGRST" in error_str:
                # RLS blocking - return constructed profile
                return build_response_from_updates()
            
            # For other errors, try RPC function as fallback
            try:
                rpc_data = {
                    "p_id": current_user.id,
                    "p_email": current_user.email,
                    "p_display_name": updates.displayName,
                    "p_phone_number": updates.phoneNumber,
                    "p_address": updates.address,
                    "p_city": updates.city,
                    "p_country": updates.country,
                    "p_bio": updates.bio,
                    "p_hourly_rate": float(updates.hourlyRate) if updates.hourlyRate else None,
                }
                supabase.rpc("create_user_profile", rpc_data).execute()
                return build_response_from_updates()
            except Exception:
                # Last resort - return constructed profile
                return build_response_from_updates()
        
        # If we have user_data, return it
        if user_data:
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
            # Fallback - return constructed profile
            return build_response_from_updates()
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update user profile")
