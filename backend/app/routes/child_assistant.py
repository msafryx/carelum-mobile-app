"""
Child Care Assistant endpoint (instruction-based).
POST /api/child-assistant: ask about the child for the current session.
Data from children, child_instructions, optional child_care_instructions.
Logs to assistant_query_logs for admin audit.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter()


class ChildAssistantRequest(BaseModel):
    child_id: str
    session_id: str
    question: str


class ChildAssistantResponse(BaseModel):
    answer: str


def _normalize(s: Optional[str]) -> str:
    if not s or not isinstance(s, str):
        return ""
    return s.strip().lower()


def _build_rule_based_answer(
    child_name: str,
    child: dict,
    instructions: Optional[dict],
    care_instructions: list,
    question: str,
) -> str:
    q = _normalize(question)
    name = child_name or "The child"
    parts = []

    # Allergies
    if "allerg" in q or "allergic" in q:
        from_child = (child.get("allergies") or "").strip()
        from_instr = ""
        if instructions:
            from_instr = (instructions.get("allergies") or "").strip()
            if isinstance(from_instr, list):
                from_instr = ", ".join(str(x) for x in from_instr)
        combined = from_child or from_instr
        if combined:
            parts.append(f"{name} is allergic to: {combined}.")
        else:
            parts.append(f"No allergy information is on file for {name}.")

    # Medicine / medication
    elif "medic" in q or "medicine" in q or "medication" in q:
        from_instr = ""
        if instructions:
            from_instr = (instructions.get("medication") or "").strip()
        if from_instr:
            parts.append(f"Medicine schedule: {from_instr}")
        else:
            parts.append(f"No medication schedule is set for {name}.")

    # Feeding / food / dinner / snack
    elif any(x in q for x in ["feed", "food", "dinner", "lunch", "breakfast", "snack", "eat"]):
        from_instr = ""
        if instructions:
            from_instr = (instructions.get("feeding_schedule") or "").strip()
        if from_instr:
            parts.append(f"Feeding instructions: {from_instr}")
        else:
            feed_from_care = [ci.get("instruction_text") for ci in care_instructions if (ci.get("instruction_type") or "").lower() == "feeding"]
            if feed_from_care:
                parts.append("Feeding: " + "; ".join(feed_from_care))
            else:
                parts.append(f"No specific feeding instructions are on file for {name}.")

    # Sleep / nap / bedtime
    elif any(x in q for x in ["sleep", "nap", "bedtime", "bed time"]):
        from_instr = ""
        if instructions:
            from_instr = (instructions.get("nap_schedule") or instructions.get("bedtime") or "").strip()
        if from_instr:
            parts.append(f"Sleep/nap: {from_instr}")
        else:
            sleep_from_care = [ci.get("instruction_text") for ci in care_instructions if (ci.get("instruction_type") or "").lower() == "sleep"]
            if sleep_from_care:
                parts.append("Sleep: " + "; ".join(sleep_from_care))
            else:
                parts.append(f"No sleep or nap routine is set for {name}.")

    # Emergency contacts
    elif "emergency" in q or "contact" in q:
        ename = (child.get("emergency_contact_name") or "").strip()
        ephone = (child.get("emergency_contact_phone") or "").strip()
        dname = (child.get("doctor_contact") or "").strip()
        dphone = (child.get("doctor_phone") or "").strip()
        if ename or ephone:
            parts.append(f"Emergency contact: {ename or 'N/A'} {ephone or ''}".strip())
        if dname or dphone:
            parts.append(f"Doctor: {dname or 'N/A'} {dphone or ''}".strip())
        if instructions and instructions.get("emergency_contacts"):
            parts.append(f"Additional emergency contacts are in the child profile.")
        if not parts:
            parts.append(f"No emergency contact details are on file for {name}.")

    # Medical notes / special instructions
    elif "medical" in q or "special" in q or "instruction" in q:
        medical = (child.get("medical_notes") or "").strip()
        special = (child.get("special_instructions") or "").strip()
        if instructions:
            special = special or (instructions.get("special_instructions") or "").strip()
        if medical:
            parts.append(f"Medical notes: {medical}")
        if special:
            parts.append(f"Special instructions: {special}")
        if not parts:
            parts.append(f"No medical notes or special instructions are on file for {name}.")

    # General / behavior / safety
    else:
        special = (child.get("special_instructions") or "").strip()
        if instructions:
            special = special or (instructions.get("special_instructions") or "").strip()
        for ci in care_instructions:
            itype = (ci.get("instruction_type") or "").lower()
            text = (ci.get("instruction_text") or "").strip()
            if text:
                parts.append(f"{itype.capitalize()}: {text}")
        if special:
            parts.append(f"Special instructions: {special}")
        if not parts:
            parts.append(
                f"Here’s what’s on file for {name}: "
                + "Medical notes and allergies are in the child profile. "
                "Ask about 'allergies', 'feeding', 'sleep', 'medicine', or 'emergency contacts' for details."
            )

    return " ".join(parts) if parts else f"I don’t have specific information about that for {name}. Try asking about allergies, feeding, sleep, medicine, or emergency contacts."


@router.post("", response_model=ChildAssistantResponse)
async def post_child_assistant(
    body: ChildAssistantRequest,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Instruction-based child care assistant. Parent and sitter only (admin cannot chat).
    Returns an answer from child profile + child_instructions. Logs the query for admin.
    """
    try:
        auth_token = credentials.credentials
        supabase = get_supabase_with_auth(auth_token)
        if not supabase:
            raise AppError(
                code="DB_NOT_AVAILABLE",
                message="Database connection not available",
                status_code=503,
            )

        # Admin cannot use the assistant to chat
        if current_user.role == "admin":
            raise AppError(
                code="FORBIDDEN",
                message="Admins cannot use the child assistant; they can view logs only.",
                status_code=403,
            )

        # Load session and verify access + child belongs to session
        session_resp = supabase.table("sessions").select("id, parent_id, sitter_id, child_id, child_ids").eq("id", body.session_id).single().execute()
        if not session_resp.data:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404,
            )
        session_data = session_resp.data
        if session_data.get("parent_id") != current_user.id and session_data.get("sitter_id") != current_user.id:
            raise AppError(
                code="FORBIDDEN",
                message="You don't have access to this session",
                status_code=403,
            )
        primary_child = session_data.get("child_id")
        child_ids = session_data.get("child_ids") or []
        if isinstance(child_ids, str):
            try:
                import json
                child_ids = json.loads(child_ids) if child_ids else []
            except Exception:
                child_ids = []
        if primary_child != body.child_id and body.child_id not in child_ids:
            raise AppError(
                code="FORBIDDEN",
                message="This child is not part of the session",
                status_code=403,
            )

        # Load child
        child_resp = supabase.table("children").select("*").eq("id", body.child_id).single().execute()
        if not child_resp.data:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404,
            )
        child_data = child_resp.data
        child_name = child_data.get("name") or "The child"

        # Load child_instructions
        instr_resp = supabase.table("child_instructions").select("*").eq("child_id", body.child_id).execute()
        instructions = instr_resp.data[0] if instr_resp.data else None

        # Optional: child_care_instructions (table may not exist on older DBs)
        care_instructions = []
        try:
            care_resp = supabase.table("child_care_instructions").select("*").eq("child_id", body.child_id).execute()
            care_instructions = care_resp.data or []
        except Exception:
            pass

        # Rule-based answer
        answer = _build_rule_based_answer(
            child_name,
            child_data,
            instructions,
            care_instructions,
            body.question,
        )

        # Log for admin
        try:
            supabase.table("assistant_query_logs").insert({
                "session_id": body.session_id,
                "user_id": current_user.id,
                "child_id": body.child_id,
                "question": body.question[:2000],
            }).execute()
        except Exception as log_err:
            # Non-fatal
            print(f"⚠️ Failed to log assistant query: {log_err}")

        return ChildAssistantResponse(answer=answer)
    except AppError:
        raise
    except Exception as e:
        raise handle_error(e, "Failed to get assistant answer")
