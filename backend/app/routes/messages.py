"""
Chat messages endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.utils.auth import verify_token, CurrentUser
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase

router = APIRouter()


class MessageResponse(BaseModel):
    """Message response model"""
    id: str
    sessionId: str
    senderId: str
    receiverId: str
    message: str
    messageType: str
    attachmentUrl: Optional[str] = None
    readAt: Optional[str] = None
    createdAt: str


class SendMessageRequest(BaseModel):
    """Request model for sending a message"""
    receiverId: str
    message: str
    messageType: str = "text"
    attachmentUrl: Optional[str] = None


def db_to_message_response(message_data: dict) -> MessageResponse:
    """Convert database message to API response"""
    return MessageResponse(
        id=message_data["id"],
        sessionId=message_data["session_id"],
        senderId=message_data["sender_id"],
        receiverId=message_data["receiver_id"],
        message=message_data["message"],
        messageType=message_data.get("message_type", "text"),
        attachmentUrl=message_data.get("attachment_url"),
        readAt=message_data.get("read_at"),
        createdAt=message_data["created_at"]
    )


def verify_session_access_for_messages(session_id: str, user: CurrentUser) -> bool:
    """Verify user has access to this session for messages"""
    try:
        supabase = get_supabase()
        if not supabase:
            return False
        
        response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not response.data:
            return False
        
        session_data = response.data
        
        if user.role == "admin":
            return True
        
        # Parents and sitters can message in their sessions
        return (
            session_data.get("parent_id") == user.id or
            session_data.get("sitter_id") == user.id
        )
    except:
        return False


@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_session_messages(
    session_id: str,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of messages to return"),
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Get chat messages for a session
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Verify session access
        if not verify_session_access_for_messages(session_id, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to messages for this session",
                status_code=403
            )
        
        # Get messages
        response = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(limit).execute()
        
        messages = []
        for message_data in (response.data or []):
            messages.append(db_to_message_response(message_data))
        
        # Reverse to get chronological order (oldest first)
        messages.reverse()
        
        return messages
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to fetch messages")


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse)
async def send_message(
    session_id: str,
    message_data: SendMessageRequest,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Send a message in a session
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Verify session access
        if not verify_session_access_for_messages(session_id, current_user):
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to send messages in this session",
                status_code=403
            )
        
        # Get session to verify participants
        session_response = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
        
        if not session_response.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404
            )
        
        session_data = session_response.data
        
        # Verify receiver is part of the session
        if message_data.receiverId != session_data.get("parent_id") and message_data.receiverId != session_data.get("sitter_id"):
            raise AppError(
                code="INVALID_RECEIVER",
                message="Receiver is not part of this session",
                status_code=400
            )
        
        # Verify sender is part of the session
        if current_user.id != session_data.get("parent_id") and current_user.id != session_data.get("sitter_id"):
            raise AppError(
                code="FORBIDDEN",
                message="You are not part of this session",
                status_code=403
            )
        
        # Insert message
        insert_data = {
            "session_id": session_id,
            "sender_id": current_user.id,
            "receiver_id": message_data.receiverId,
            "message": message_data.message,
            "message_type": message_data.messageType,
            "attachment_url": message_data.attachmentUrl,
        }
        
        response = supabase.table("chat_messages").insert(insert_data).select().execute()
        
        if not response.data:
            raise AppError(
                code="CREATE_FAILED",
                message="Failed to send message",
                status_code=500
            )
        
        return db_to_message_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to send message")


@router.put("/messages/{message_id}/read", response_model=MessageResponse)
async def mark_message_as_read(
    message_id: str,
    current_user: CurrentUser = Depends(verify_token)
):
    """
    Mark message as read
    """
    try:
        supabase = get_supabase()
        
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503
            )
        
        # Get existing message
        response = supabase.table("chat_messages").select("*").eq("id", message_id).single().execute()
        
        if not response.data:
            raise AppError(
                code="MESSAGE_NOT_FOUND",
                message="Message not found",
                status_code=404
            )
        
        message_data = response.data
        
        # Verify user is the receiver
        if message_data.get("receiver_id") != current_user.id:
            raise AppError(
                code="FORBIDDEN",
                message="You can only mark your own messages as read",
                status_code=403
            )
        
        # Update read_at timestamp
        update_data = {
            "read_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("chat_messages").update(update_data).eq("id", message_id).select().execute()
        
        if not response.data:
            raise AppError(
                code="UPDATE_FAILED",
                message="Failed to mark message as read",
                status_code=500
            )
        
        return db_to_message_response(response.data[0])
        
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to mark message as read")
