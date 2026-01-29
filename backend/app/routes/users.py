"""
User and profile management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
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
    isActive: Optional[bool] = None  # Sitter availability status
    lastActiveAt: Optional[str] = None  # Last active timestamp
    latitude: Optional[float] = None  # Current location latitude
    longitude: Optional[float] = None  # Current location longitude
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
    isActive: Optional[bool] = None  # For sitters: toggle online/offline status
    latitude: Optional[float] = None  # Current location latitude
    longitude: Optional[float] = None  # Current location longitude


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
            isActive=user_data.get("is_active"),
            lastActiveAt=user_data.get("last_active_at"),
            latitude=float(user_data["latitude"]) if user_data.get("latitude") else None,
            longitude=float(user_data["longitude"]) if user_data.get("longitude") else None,
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
        
        # Handle sitter availability and location (for active status)
        if 'isActive' in updates_dict:
            update_data["is_active"] = updates.isActive
            # Update last_active_at when toggling to active
            if updates.isActive:
                from datetime import datetime
                update_data["last_active_at"] = datetime.utcnow().isoformat()
            print(f"✅ Including isActive in update: {updates.isActive}")
        
        if 'latitude' in updates_dict:
            # Convert to float for JSON serialization (Supabase will handle Decimal conversion)
            update_data["latitude"] = float(updates.latitude) if updates.latitude is not None else None
            print(f"✅ Including latitude in update: {updates.latitude}")
        
        if 'longitude' in updates_dict:
            # Convert to float for JSON serialization (Supabase will handle Decimal conversion)
            update_data["longitude"] = float(updates.longitude) if updates.longitude is not None else None
            print(f"✅ Including longitude in update: {updates.longitude}")
        
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
        
        # Update user profile - update first, then read back
        user_data = None
        update_successful = False
        try:
            print(f"🔄 Attempting to update user {current_user.id} with data: {update_data}")
            # Update the user (without select - some Supabase client versions don't support select after eq)
            update_response = supabase.table("users").update(update_data).eq("id", current_user.id).execute()
            
            print(f"📥 Update response: {update_response}")
            
            # Read the updated user back separately
            print(f"📖 Reading updated user data...")
            read_response = supabase.table("users").select("*").eq("id", current_user.id).single().execute()
            
            if read_response.data:
                user_data = read_response.data
                update_successful = True
                print(f"✅ Update successful, got updated row from database")
            else:
                print(f"❌ Cannot read user after update - update may have failed")
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
                isActive=user_data.get("is_active"),
                lastActiveAt=user_data.get("last_active_at"),
                latitude=float(user_data["latitude"]) if user_data.get("latitude") else None,
                longitude=float(user_data["longitude"]) if user_data.get("longitude") else None,
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
    limit: int = 100,
    request_mode: Optional[str] = Query(None, description="Filter by request mode: invite, nearby, city, nationwide"),
    parent_latitude: Optional[float] = Query(None, description="Parent's latitude (for nearby search)"),
    parent_longitude: Optional[float] = Query(None, description="Parent's longitude (for nearby search)"),
    parent_city: Optional[str] = Query(None, description="Parent's city (for city search)"),
    max_distance_km: Optional[float] = Query(None, description="Maximum distance in km (for nearby search)"),
    sitter_id: Optional[str] = Query(None, description="Specific sitter ID (for invite mode)")
):
    """
    Get list of verified sitters (for parents to browse and select)
    Only verified and active sitters are returned (except for invite mode)
    
    Filtering rules:
    - invite: Returns only the specified sitter (if sitter_id provided)
    - nearby: Returns active sitters within max_distance_km radius of parent location
    - city: Returns active sitters in the same city as parent
    - nationwide: Returns all active sitters
    - Default (no mode): Returns all active sitters (for backward compatibility)
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
        
        # Base query: verified sitters only
        query = supabase.table("users").select("*").eq("role", "sitter").eq("is_verified", True)
        
        # Filter by request mode
        if request_mode == "invite":
            # Invite mode: show all verified sitters for browsing (regardless of active status)
            # If specific sitter_id provided, filter to that sitter only
            if sitter_id:
                query = query.eq("id", sitter_id)
            # Otherwise, show all verified sitters so parent can browse and select
            # Note: Active status not required for invite mode - parent can invite any verified sitter
        else:
            # For all other modes (nearby, city, nationwide), only show active sitters
            query = query.eq("is_active", True)
            
            if request_mode == "nearby":
                # Nearby mode: filter by distance (will be done in Python after fetching)
                if not parent_latitude or not parent_longitude:
                    print(f"⚠️ Nearby mode requires parent location, returning empty list")
                    return []
                if not max_distance_km:
                    max_distance_km = 10.0  # Default 10km radius
                print(f"📍 Nearby search: parent at ({parent_latitude}, {parent_longitude}), radius: {max_distance_km}km")
            elif request_mode == "city":
                # City mode: filter by city match
                if parent_city:
                    query = query.eq("city", parent_city)
                    print(f"📍 City search: filtering by city '{parent_city}'")
                else:
                    print(f"⚠️ City mode requires parent_city, returning empty list")
                    return []
            # nationwide mode: no additional filters, just active sitters
            print(f"🔍 Filtering for active sitters (is_active = True)")
        
        # Order by created_at (newest first) or you could order by rating/reviews if available
        query = query.order("created_at", desc=True).limit(limit * 2)  # Fetch more for distance filtering
        
        print(f"🔍 Querying verified sitters for user {current_user.id} (role: {current_user.role}, mode: {request_mode})")
        print(f"📋 Query filters: role=sitter, is_verified=True" + (f", is_active=True" if request_mode != "invite" else ""))
        
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
            
            print(f"📥 Found {len(response.data or [])} verified sitters (before distance/location filtering)")
            
            if not response.data:
                print(f"⚠️ No verified sitters found. Possible reasons:")
                print(f"   1. No sitters with is_verified = true and is_active = true")
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
        
        # Convert to response format and apply distance filtering for nearby mode
        sitters = []
        for user_data in (response.data or []):
            # For nearby mode, calculate distance and filter
            if request_mode == "nearby" and parent_latitude and parent_longitude:
                sitter_lat = user_data.get("latitude")
                sitter_lng = user_data.get("longitude")
                
                if sitter_lat is None or sitter_lng is None:
                    # Skip sitters without location data
                    continue
                
                # Calculate distance using Haversine formula
                from math import radians, cos, sin, asin, sqrt
                
                def haversine_distance(lat1, lon1, lat2, lon2):
                    """Calculate distance between two points on Earth in km"""
                    R = 6371  # Earth radius in km
                    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                    dlat = lat2 - lat1
                    dlon = lon2 - lon1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    return R * c
                
                distance = haversine_distance(
                    float(parent_latitude),
                    float(parent_longitude),
                    float(sitter_lat),
                    float(sitter_lng)
                )
                
                if distance > max_distance_km:
                    # Skip sitters outside the radius
                    continue
            
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
                isActive=user_data.get("is_active"),
                lastActiveAt=user_data.get("last_active_at"),
                latitude=float(user_data["latitude"]) if user_data.get("latitude") else None,
                longitude=float(user_data["longitude"]) if user_data.get("longitude") else None,
                createdAt=user_data["created_at"],
                updatedAt=user_data.get("updated_at", user_data["created_at"])
            ))
        
        # Limit results after filtering
        sitters = sitters[:limit]
        
        print(f"✅ Found {len(sitters)} verified sitters (after filtering)")
        return sitters
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch verified sitters")
