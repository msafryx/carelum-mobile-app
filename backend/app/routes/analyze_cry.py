"""
=============================================================================
STEP 7 — BACKEND INTEGRATION: POST /api/analyze-cry
=============================================================================
Responsibilities:
  1. Receive audio from mobile app (multipart, file)
  2. Send audio to AI microservice (http://localhost:8001/predict)
  3. Wait for prediction
  4. Save prediction to database (cry_analysis table)
  5. Return result to mobile app

Uses HTTP request to call AI service: POST {AI_SERVICE_URL}/predict
=============================================================================
"""

import logging
import os
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.utils.auth import CurrentUser, security, verify_token
from app.utils.database import get_supabase_with_auth
from app.utils.error_handler import AppError

logger = logging.getLogger(__name__)

# AI microservice URL (run ai_service on port 8001 when backend is on 8000)
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001").rstrip("/")

router = APIRouter()


class AnalyzeCryResponse(BaseModel):
    """Response for POST /api/analyze-cry"""
    success: bool = True
    cry_type: str
    analysis_id: Optional[str] = None
    session_id: Optional[str] = None
    suggested_action: Optional[str] = None


def _suggested_action(cry_type: str) -> str:
    """Step 9 — Suggested action message for parent."""
    actions = {
        "belly pain": "Comfort the baby, try gentle tummy massage or consult a doctor if it persists.",
        "burping": "Hold the baby upright and gently pat or rub their back to help them burp.",
        "discomfort": "Check diaper, clothing, temperature, or position. Adjust and comfort the baby.",
        "hungry": "Feed the baby or check feeding schedule.",
        "tired": "Create a calm environment, try rocking or a nap. Avoid overstimulation.",
    }
    return actions.get(cry_type.lower(), "Comfort the baby and check for obvious causes.")


@router.post("/analyze-cry", response_model=AnalyzeCryResponse)
async def analyze_cry(
    file: UploadFile = File(..., description="WAV audio of baby cry"),
    session_id: Optional[str] = Form(None, description="Session ID so alert is created for parent and sitter"),
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    STEP 7 — Analyze baby cry audio.
    1. Receive audio from mobile app
    2. Send to AI service (POST /predict)
    3. Wait for prediction
    4. Save to cry_analysis table in Supabase
    5. Return cry_type and suggested action to app
    """
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {"code": "AUTH_ERROR", "message": "Failed to authenticate with database."},
            },
        )

    # Validate file type
    if not file.filename or not file.filename.lower().endswith((".wav", ".wave")):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_AUDIO_FORMAT",
                    "message": "Only .wav audio files are accepted.",
                },
            },
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {"code": "EMPTY_FILE", "message": "Uploaded file is empty."},
            },
        )

    # 2. Send audio to AI service
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/predict",
                files={"file": (file.filename or "audio.wav", audio_bytes, "audio/wav")},
            )
    except httpx.ConnectError as e:
        logger.error(f"AI service unavailable: {AI_SERVICE_URL} — {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "error": {
                    "code": "AI_SERVICE_UNAVAILABLE",
                    "message": "Cry analysis service is temporarily unavailable. Please try again later.",
                },
            },
        ) from e
    except httpx.TimeoutException as e:
        logger.error(f"AI service timeout: {e}")
        raise HTTPException(
            status_code=504,
            detail={
                "success": False,
                "error": {
                    "code": "AI_SERVICE_TIMEOUT",
                    "message": "Cry analysis took too long. Please try again.",
                },
            },
        ) from e
    except Exception as e:
        logger.exception("Error calling AI service")
        raise HTTPException(
            status_code=502,
            detail={
                "success": False,
                "error": {
                    "code": "AI_SERVICE_ERROR",
                    "message": f"Failed to get prediction: {str(e)}",
                },
            },
        ) from e

    # 3. Parse prediction
    if response.status_code != 200:
        try:
            err_body = response.json()
            msg = err_body.get("detail", {}).get("error", {}).get("message", response.text)
        except Exception:
            msg = response.text or "Unknown error from AI service"
        raise HTTPException(
            status_code=response.status_code,
            detail={
                "success": False,
                "error": {
                    "code": "AI_PREDICTION_FAILED",
                    "message": msg,
                },
            },
        )

    try:
        data = response.json()
        cry_type = data.get("cry_type")
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_AI_RESPONSE",
                    "message": f"Invalid response from AI service: {str(e)}",
                },
            },
        ) from e

    if not cry_type:
        raise HTTPException(
            status_code=502,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_CRY_TYPE",
                    "message": "AI service did not return cry_type.",
                },
            },
        )

    # 4. Save to database (cry_analysis table)
    analysis_id = str(uuid.uuid4())
    suggested_action = _suggested_action(cry_type)
    # audio_url can be filled if you upload to Supabase Storage first; here we store prediction only
    audio_url = None

    try:
        insert_data = {
            "id": analysis_id,
            "session_id": session_id,
            "audio_url": audio_url,
            "cry_type": cry_type,
            "confidence_score": None,  # Optional: add when AI returns it
            "user_id": current_user.id,  # For RLS: restrict to owning user
        }
        result = supabase.table("cry_analysis").insert(insert_data).execute()
        if result.data is None and getattr(result, "error", None):
            raise AppError(
                "DB_INSERT_FAILED",
                f"Failed to save cry analysis: {getattr(result.error, 'message', result.error)}",
                status_code=500,
            )
    except AppError:
        raise
    except Exception as e:
        logger.exception("Failed to insert cry_analysis")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "Failed to save analysis result.",
                },
            },
        ) from e

    # 5. Create alert for parent and sitter when session_id is provided (so both see the cry detection)
    if session_id and suggested_action:
        try:
            session_row = supabase.table("sessions").select("parent_id, sitter_id, child_id").eq("id", session_id).single().execute()
            if session_row.data:
                parent_id = session_row.data.get("parent_id")
                sitter_id = session_row.data.get("sitter_id")
                child_id = session_row.data.get("child_id")
                if parent_id:
                    cry_label = cry_type.replace("_", " ").title()
                    alert_title = "Baby cry detected"
                    alert_message = f"Possible reason: {cry_label}. Suggested action: {suggested_action}"
                    supabase.table("alerts").insert({
                        "session_id": session_id,
                        "child_id": child_id,
                        "parent_id": parent_id,
                        "sitter_id": sitter_id or None,
                        "type": "cry_detection",
                        "severity": "medium",
                        "title": alert_title,
                        "message": alert_message,
                        "status": "new",
                        "audio_log_id": analysis_id,
                    }).execute()
        except Exception as alert_err:
            logger.warning("Failed to create cry_detection alert: %s", alert_err)

    # 6. Return result to mobile app
    return AnalyzeCryResponse(
        success=True,
        cry_type=cry_type,
        analysis_id=analysis_id,
        session_id=session_id,
        suggested_action=suggested_action,
    )
