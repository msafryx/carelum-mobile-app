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
from app.utils.database import get_supabase_with_auth, get_supabase_service_role
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


def _instr_str(val, default: str = "") -> str:
    """Get a string from instruction field that may be str or list (JSONB)."""
    if val is None:
        return default
    if isinstance(val, list):
        return ", ".join(str(x).strip() for x in val if x is not None).strip() or default
    if isinstance(val, str):
        return val.strip() or default
    return str(val).strip() or default


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
        from_child = _instr_str(child.get("allergies"))
        from_instr = _instr_str(instructions.get("allergies") if instructions else None)
        combined = from_child or from_instr
        if combined:
            parts.append(f"{name} is allergic to: {combined}.")
        else:
            parts.append(f"No allergy information is on file for {name}.")

    # Medicine / medication
    elif "medic" in q or "medicine" in q or "medication" in q:
        from_instr = _instr_str(instructions.get("medication") if instructions else None)
        if from_instr:
            parts.append(f"Medicine schedule: {from_instr}")
        else:
            parts.append(f"No medication schedule is set for {name}.")

    # Feeding / food / dinner / snack
    elif any(x in q for x in ["feed", "food", "dinner", "lunch", "breakfast", "snack", "eat"]):
        from_instr = _instr_str(instructions.get("feeding_schedule") if instructions else None)
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
        from_instr = _instr_str(
            (instructions.get("nap_schedule") or instructions.get("bedtime")) if instructions else None
        )
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
        medical = _instr_str(child.get("medical_notes"))
        special = _instr_str(child.get("special_instructions"))
        if instructions:
            special = special or _instr_str(instructions.get("special_instructions"))
        if medical:
            parts.append(f"Medical notes: {medical}")
        if special:
            parts.append(f"Special instructions: {special}")
        if not parts:
            parts.append(f"No medical notes or special instructions are on file for {name}.")

    # General / behavior / safety
    else:
        special = _instr_str(child.get("special_instructions"))
        if instructions:
            special = special or _instr_str(instructions.get("special_instructions"))
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

        # Load session and verify access (use limit(1) to avoid PGRST116 when RLS returns 0 rows)
        session_resp = supabase.table("sessions").select("id, parent_id, sitter_id, child_id, child_ids").eq("id", body.session_id).limit(1).execute()
        if not session_resp.data or len(session_resp.data) == 0:
            raise AppError(
                code="SESSION_NOT_FOUND",
                message="Session not found",
                status_code=404,
            )
        session_data = session_resp.data[0]
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

        # Load child and child_instructions with service-role so sitter can read (RLS often blocks sitter on children/child_instructions)
        sb_svc = get_supabase_service_role()
        if not sb_svc:
            sb_svc = supabase
        child_resp = sb_svc.table("children").select("*").eq("id", body.child_id).limit(1).execute()
        if not child_resp.data or len(child_resp.data) == 0:
            raise AppError(
                code="CHILD_NOT_FOUND",
                message="Child not found",
                status_code=404,
            )
        child_data = child_resp.data[0]
        child_name = child_data.get("name") or "The child"

        # Merge emergency/doctor from child_instructions into child_data for _build_rule_based_answer
        instr_resp = sb_svc.table("child_instructions").select("*").eq("child_id", body.child_id).limit(1).execute()
        instructions = instr_resp.data[0] if instr_resp.data and len(instr_resp.data) > 0 else None
        if instructions and instructions.get("emergency_contacts") and not (child_data.get("emergency_contact_phone") or child_data.get("emergency_contact_name")):
            ec = instructions["emergency_contacts"]
            if isinstance(ec, list) and len(ec) > 0 and isinstance(ec[0], dict):
                child_data = dict(child_data)
                child_data["emergency_contact_name"] = child_data.get("emergency_contact_name") or ec[0].get("name")
                child_data["emergency_contact_phone"] = child_data.get("emergency_contact_phone") or ec[0].get("phone")
            elif isinstance(ec, dict) and ec.get("phone"):
                child_data = dict(child_data)
                child_data["emergency_contact_name"] = child_data.get("emergency_contact_name") or ec.get("name")
                child_data["emergency_contact_phone"] = child_data.get("emergency_contact_phone") or ec.get("phone")
        if instructions and instructions.get("doctor_info") and isinstance(instructions["doctor_info"], dict):
            di = instructions["doctor_info"]
            if not child_data.get("doctor_phone") or not child_data.get("doctor_contact"):
                child_data = dict(child_data)
                child_data["doctor_contact"] = child_data.get("doctor_contact") or di.get("name")
                child_data["doctor_phone"] = child_data.get("doctor_phone") or di.get("phone")

        # Optional: child_care_instructions (table may not exist on older DBs)
        care_instructions = []
        try:
            care_resp = sb_svc.table("child_care_instructions").select("*").eq("child_id", body.child_id).execute()
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
