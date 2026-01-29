"""
Children and child instructions management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter()


class ChildResponse(BaseModel):
    """Child response model"""
    id: str
    parentId: str
    name: str
    age: Optional[int] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    photoUrl: Optional[str] = None
    childNumber: Optional[str] = None
    parentNumber: Optional[str] = None
    sitterNumber: Optional[str] = None
    createdAt: str
    updatedAt: str


class CreateChildRequest(BaseModel):
    """Request model for creating a child"""
    name: str
    age: Optional[int] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    photoUrl: Optional[str] = None
    childNumber: Optional[str] = None
    parentNumber: Optional[str] = None


class UpdateChildRequest(BaseModel):
    """Request model for updating a child"""
    name: Optional[str] = None
    age: Optional[int] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None
    photoUrl: Optional[str] = None
    childNumber: Optional[str] = None
    parentNumber: Optional[str] = None
    sitterNumber: Optional[str] = None


class ChildInstructionsResponse(BaseModel):
    """Child instructions response model"""
    id: str
    childId: str
    parentId: str
    feedingSchedule: Optional[str] = None
    napSchedule: Optional[str] = None
    medication: Optional[str] = None
    allergies: Optional[str] = None
    emergencyContacts: Optional[dict] = None
    specialInstructions: Optional[str] = None
    createdAt: str
    updatedAt: str


class UpdateChildInstructionsRequest(BaseModel):
    """Request model for updating child instructions"""
    feedingSchedule: Optional[str] = None
    napSchedule: Optional[str] = None
    medication: Optional[str] = None
    allergies: Optional[str] = None
    emergencyContacts: Optional[dict] = None
    specialInstructions: Optional[str] = None


def db_to_child_response(child_data: dict) -> ChildResponse:
    """Convert database child to API response"""
    return ChildResponse(
        id=child_data["id"],
        parentId=child_data["parent_id"],
        name=child_data["name"],
        age=child_data.get("age"),
        dateOfBirth=child_data.get("date_of_birth"),
        gender=child_data.get("gender"),
        photoUrl=child_data.get("photo_url"),
        childNumber=child_data.get("child_number"),
        parentNumber=child_data.get("parent_number"),
        sitterNumber=child_data.get("sitter_number"),
        createdAt=child_data["created_at"],
        updatedAt=child_data.get("updated_at", child_data["created_at"])
    )


def db_to_instructions_response(instructions_data: dict) -> ChildInstructionsResponse:
    """Convert database instructions to API response"""
    return ChildInstructionsResponse(
        id=instructions_data["id"],
        childId=instructions_data["child_id"],
        parentId=instructions_data["parent_id"],
        feedingSchedule=instructions_data.get("feeding_schedule"),
        napSchedule=instructions_data.get("nap_schedule"),
        medication=instructions_data.get("medication"),
        allergies=instructions_data.get("allergies"),
        emergencyContacts=instructions_data.get("emergency_contacts"),
        specialInstructions=instructions_data.get("special_instructions"),
        createdAt=instructions_data["created_at"],
        updatedAt=instructions_data.get("updated_at", instructions_data["created_at"])
    )


def verify_child_access(child_data: dict, user: CurrentUser) -> bool:
    """Verify user has access to this child"""
    if user.role == "admin":
        return True
    return child_data.get("parent_id") == user.id


@router.get("", response_model=List[ChildResponse])
async def get_parent_children(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get current user's children (parent only)
    """
    try:
        # CRITICAL: Use Supabase client with user's auth token for RLS to work!
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        
        if not supabase:
            raise AppError(
                code="AUTH_ERROR",
                message="Failed to authenticate with database",
                status_code=500
            )
        
        # Only parents can get their children
        if current_user.role != "parent":
            raise AppError(
                code="FORBIDDEN",
                message="Only parents can view children",
                status_code=403
            )
        
        response = supabase.table("children").select("*").eq("parent_id", current_user.id).order("created_at", desc=True).execute()
        
        children = []
        for child_data in (response.data or []):
            children.append(db_to_child_response(child_data))
        
        return children
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch children")


@router.get("/{child_id}", response_model=ChildResponse)
async def get_child_by_id(
    child_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get child by ID
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Query without .single() to avoid error when child doesn't exist
        # .single() throws an exception if 0 rows, so we check the result instead
        try:
            response = supabase.table("children").select("*").eq("id", child_id).single().execute()
            child_data = response.data
        except Exception as query_error:
            # Check if it's a "0 rows" error (child not found)
            error_str = str(query_error)
            if "0 rows" in error_str or "PGRST116" in error_str or "Cannot coerce" in error_str:
                raise AppError(
                    code="CHILD_NOT_FOUND",
                    message="Child not found",
                    status_code=404
                )
            # Re-raise other errors
            raise
        
        if not child_data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404
            )
        
        # Verify access
        if not verify_child_access(child_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this child",
                status_code=403
            )
        
        return db_to_child_response(child_data)
        
    except AppError as e:
        raise handle_error(e, "Failed to fetch child")
    except Exception as e:
        raise handle_error(e, "Failed to fetch child")


@router.post("", response_model=ChildResponse)
async def create_child(
    child_data: CreateChildRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Create a new child profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Only parents can create children
        if current_user.role != "parent":
            raise AppError(
                code="FORBIDDEN",
                message="Only parents can create children",
                status_code=403
            )
        
        # Insert child
        insert_data = {
            "parent_id": current_user.id,
            "name": child_data.name,
            "age": child_data.age,
            "date_of_birth": child_data.dateOfBirth,
            "gender": child_data.gender,
            "photo_url": child_data.photoUrl,
            "child_number": child_data.childNumber,
            "parent_number": child_data.parentNumber,
        }
        
        response = supabase.table("children").insert(insert_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="CREATE_FAILED",
                message="Failed to create child",
                status_code=500
            )
        
        return db_to_child_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to create child")


@router.put("/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: str,
    updates: UpdateChildRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Update child profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing child
        response = supabase.table("children").select("*").eq("id", child_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404
            )
        
        child_data = response.data
        
        # Verify access
        if not verify_child_access(child_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this child",
                status_code=403
            )
        
        # Build update data
        update_data = {}
        if updates.name is not None:
            update_data["name"] = updates.name
        if updates.age is not None:
            update_data["age"] = updates.age
        if updates.dateOfBirth is not None:
            update_data["date_of_birth"] = updates.dateOfBirth
        if updates.gender is not None:
            update_data["gender"] = updates.gender
        if updates.photoUrl is not None:
            update_data["photo_url"] = updates.photoUrl
        if updates.childNumber is not None:
            update_data["child_number"] = updates.childNumber
        if updates.parentNumber is not None:
            update_data["parent_number"] = updates.parentNumber
        if updates.sitterNumber is not None:
            update_data["sitter_number"] = updates.sitterNumber
        
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update child
        response = supabase.table("children").update(update_data).eq("id", child_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update child",
                status_code=500
            )
        
        return db_to_child_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update child")


@router.delete("/{child_id}")
async def delete_child(
    child_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Delete child profile
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing child
        response = supabase.table("children").select("*").eq("id", child_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404
            )
        
        child_data = response.data
        
        # Verify access
        if not verify_child_access(child_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this child",
                status_code=403
            )
        
        # Delete child
        supabase.table("children").delete().eq("id", child_id).execute()
        
        return {
            "success": True,
            "message": "Child deleted successfully"
        }
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to delete child")


@router.get("/{child_id}/instructions", response_model=ChildInstructionsResponse)
async def get_child_instructions(
    child_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get child instructions
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get child first to verify access
        child_response = supabase.table("children").select("*").eq("id", child_id).single().execute()
        
        if not child_response.data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404
            )
        
        child_data = child_response.data
        
        # Verify access
        if not verify_child_access(child_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this child",
                status_code=403
            )
        
        # Get instructions
        response = supabase.table("child_instructions").select("*").eq("child_id", child_id).single().execute()
        
        if not response.data:
            # Return empty instructions if not found
            return ChildInstructionsResponse(
                id="",
                childId=child_id,
                parentId=child_data["parent_id"],
                createdAt=datetime.utcnow().isoformat(),
                updatedAt=datetime.utcnow().isoformat()
            )
        
        return db_to_instructions_response(response.data)
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch child instructions")


@router.put("/{child_id}/instructions", response_model=ChildInstructionsResponse)
async def update_child_instructions(
    child_id: str,
    updates: UpdateChildInstructionsRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Update child instructions
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get child first to verify access
        child_response = supabase.table("children").select("*").eq("id", child_id).single().execute()
        
        if not child_response.data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404
            )
        
        child_data = child_response.data
        
        # Verify access
        if not verify_child_access(child_data, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this child",
                status_code=403
            )
        
        # Check if instructions exist
        existing = supabase.table("child_instructions").select("*").eq("child_id", child_id).single().execute()
        
        update_data = {
            "feeding_schedule": updates.feedingSchedule,
            "nap_schedule": updates.napSchedule,
            "medication": updates.medication,
            "allergies": updates.allergies,
            "emergency_contacts": updates.emergencyContacts,
            "special_instructions": updates.specialInstructions,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if existing.data:
            # Update existing
            response = supabase.table("child_instructions").update(update_data).eq("child_id", child_id).select().execute()
        else:
            # Create new
            update_data["child_id"] = child_id
            update_data["parent_id"] = current_user.id
            response = supabase.table("child_instructions").insert(update_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to update child instructions",
                status_code=500
            )
        
        return db_to_instructions_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to update child instructions")
