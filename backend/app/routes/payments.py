"""
Payment endpoints: Stripe customer, payment intent (manual capture), capture, webhook.
Parent pays before session; payment is captured after session completion; sitter payout is separate (see sitters/connect).
"""
import os
import logging
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase, get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
router = APIRouter()

# Stripe is optional: if STRIPE_SECRET_KEY is not set, endpoints return 503
def _stripe():
    import stripe
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        return None
    stripe.api_key = key
    return stripe


def _get_supabase_service():
    """Prefer service role for payment writes (bypasses RLS). Falls back to anon."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return get_supabase()
    from supabase import create_client
    return create_client(url, key)


# --- Request/Response models ---
class CreateCustomerResponse(BaseModel):
    stripeCustomerId: Optional[str] = None
    alreadyExists: bool = False


class CreateIntentInput(BaseModel):
    session_id: str


class CreateIntentResponse(BaseModel):
    clientSecret: str
    paymentIntentId: Optional[str] = None


class CaptureInput(BaseModel):
    session_id: str


# --- Create Stripe customer (parent) ---
@router.post("/create-customer", response_model=CreateCustomerResponse)
async def create_customer(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create or return existing Stripe customer for the parent. Store stripe_customer_id in payment_methods."""
    if current_user.role != "parent":
        raise AppError(
            code="FORBIDDEN",
            message="Only parents can create payment customer",
            status_code=403,
        )
    stripe_obj = _stripe()
    if not stripe_obj:
        raise AppError(
            code="PAYMENT_UNAVAILABLE",
            message="Stripe is not configured",
            status_code=503,
        )
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    # Check existing
    existing = supabase.table("payment_methods").select("*").eq("parent_id", current_user.id).execute()
    if existing.data and len(existing.data) > 0:
        row = existing.data[0]
        if row.get("stripe_customer_id"):
            return CreateCustomerResponse(stripeCustomerId=row["stripe_customer_id"], alreadyExists=True)
        # Row exists but no customer id: create one and update
    else:
        # Insert row for parent
        supabase.table("payment_methods").insert({
            "parent_id": current_user.id,
        }).execute()
        existing = supabase.table("payment_methods").select("*").eq("parent_id", current_user.id).execute()
        if not existing.data:
            raise AppError(code="DB_ERROR", message="Failed to create payment_methods row", status_code=500)

    row = existing.data[0]
    if row.get("stripe_customer_id"):
        return CreateCustomerResponse(stripeCustomerId=row["stripe_customer_id"], alreadyExists=True)

    try:
        customer = stripe_obj.Customer.create(
            email=current_user.email or "",
            metadata={"carelum_parent_id": current_user.id},
        )
    except Exception as e:
        logger.exception("Stripe customer create failed")
        raise AppError(code="STRIPE_ERROR", message=str(e), status_code=502)

    supabase.table("payment_methods").update({
        "stripe_customer_id": customer.id,
        "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
    }).eq("parent_id", current_user.id).execute()

    return CreateCustomerResponse(stripeCustomerId=customer.id, alreadyExists=False)


# --- Create Payment Intent (parent pays for session) ---
@router.post("/create-intent", response_model=CreateIntentResponse)
async def create_intent(
    body: CreateIntentInput,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create Stripe PaymentIntent for session (manual capture). Returns client_secret for Stripe SDK."""
    stripe_obj = _stripe()
    if not stripe_obj:
        raise AppError(code="PAYMENT_UNAVAILABLE", message="Stripe is not configured", status_code=503)
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)

    session_id = body.session_id
    session_resp = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
    if not session_resp.data:
        raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
    session_data = session_resp.data
    if session_data.get("parent_id") != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not your session", status_code=403)
    if session_data.get("status") != "payment_pending":
        raise AppError(
            code="INVALID_STATUS",
            message="Session is not awaiting payment",
            status_code=400,
        )
    estimated = session_data.get("estimated_amount")
    if not estimated:
        raise AppError(code="INVALID_SESSION", message="Session has no estimated amount", status_code=400)

    # Amount in cents (converts from LKR if CURRENCY_IS_LKR=1)
    amount_cents = _amount_to_cents(estimated)

    pm = supabase.table("payment_methods").select("stripe_customer_id").eq("parent_id", current_user.id).execute()
    if not pm.data or not pm.data[0].get("stripe_customer_id"):
        raise AppError(
            code="NO_PAYMENT_METHOD",
            message="Add a payment method in profile first",
            status_code=400,
        )
    stripe_customer_id = pm.data[0]["stripe_customer_id"]

    # Idempotent: if payment already exists and is pending/authorized, return its client_secret
    pay_resp = supabase.table("payments").select("id, stripe_payment_intent_id, payment_status").eq("session_id", session_id).execute()
    if pay_resp.data:
        row = pay_resp.data[0]
        pid = row.get("stripe_payment_intent_id")
        status = row.get("payment_status")
        if pid and status in ("pending", "authorized"):
            try:
                pi = stripe_obj.PaymentIntent.retrieve(pid)
                if pi.client_secret:
                    return CreateIntentResponse(clientSecret=pi.client_secret, paymentIntentId=pid)
            except Exception:
                pass

    try:
        intent = stripe_obj.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=stripe_customer_id,
            capture_method="manual",
            metadata={"session_id": session_id, "parent_id": current_user.id},
        )
    except Exception as e:
        logger.exception("PaymentIntent create failed")
        raise AppError(code="STRIPE_ERROR", message=str(e), status_code=502)

    sb_service = _get_supabase_service()
    if sb_service:
        try:
            sb_service.table("payments").insert({
                "session_id": session_id,
                "parent_id": current_user.id,
                "amount_estimated": float(estimated),
                "currency": "usd",
                "stripe_payment_intent_id": intent.id,
                "payment_status": "pending",
            }).execute()
        except Exception as insert_err:
            # Duplicate session_id: update existing row
            logger.warning("Payments insert failed (may already exist): %s", insert_err)
            try:
                sb_service.table("payments").update({
                    "stripe_payment_intent_id": intent.id,
                    "payment_status": "pending",
                    "amount_estimated": float(estimated),
                    "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
                }).eq("session_id", session_id).execute()
            except Exception as up_err:
                logger.warning("Payments update failed: %s", up_err)

    return CreateIntentResponse(clientSecret=intent.client_secret, paymentIntentId=intent.id)


def _amount_to_cents(amount_decimal):
    """Convert amount to Stripe cents. If CURRENCY_IS_LKR=1, convert LKR to USD first."""
    amount = float(amount_decimal or 0)
    if os.getenv("CURRENCY_IS_LKR") == "1":
        rate = float(os.getenv("LKR_TO_USD_RATE", "320"))
        amount = amount / rate  # LKR -> USD
    return max(50, int(Decimal(str(amount)) * 100))


def do_capture_after_session_end(session_id: str):
    """
    Capture payment for a completed session. If parent already authorized (payment row with authorized),
    capture that. Otherwise charge parent's saved card now (payment on session end).
    Returns (True, amount_final) if charged, (False, None) if not.
    """
    stripe_obj = _stripe()
    sb_service = _get_supabase_service()
    if not stripe_obj or not sb_service:
        return False, None
    session_resp = sb_service.table("sessions").select("*").eq("id", session_id).single().execute()
    if not session_resp.data or session_resp.data.get("status") != "completed":
        return False, None
    session_data = session_resp.data
    total_amount = session_data.get("total_amount") or session_data.get("estimated_amount")
    if not total_amount or float(total_amount) < 0.01:
        return False, None
    amount_cents = _amount_to_cents(total_amount)
    parent_id = session_data.get("parent_id")
    pay_resp = sb_service.table("payments").select("*").eq("session_id", session_id).single().execute()
    pay = pay_resp.data if pay_resp.data else None
    # Path 1: already authorized — capture it
    if pay and pay.get("payment_status") == "authorized":
        pid = pay.get("stripe_payment_intent_id")
        if not pid:
            return False, None
        try:
            pi = stripe_obj.PaymentIntent.retrieve(pid)
            authorized = getattr(pi, "amount", None) or (pi.get("amount") if isinstance(pi, dict) else None)
            if authorized is not None and amount_cents > int(authorized):
                amount_cents = int(authorized)
            if amount_cents < 50:
                return False, None
            stripe_obj.PaymentIntent.capture(pid, amount_to_capture=amount_cents)
        except Exception as e:
            logger.exception("Capture failed: %s", e)
            return False, None
        amount_final_val = amount_cents / 100.0
        sb_service.table("payments").update({
            "payment_status": "captured",
            "amount_final": amount_final_val,
            "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
        }).eq("session_id", session_id).execute()
        _do_payout(stripe_obj, sb_service, session_id, session_data, amount_final_val)
        return True, amount_final_val
    # Path 2: charge parent's saved card now (payment on end)
    if not parent_id:
        return False, None
    pm_row = sb_service.table("payment_methods").select("stripe_customer_id").eq("parent_id", parent_id).execute()
    if not pm_row.data or not pm_row.data[0].get("stripe_customer_id"):
        return False, None
    customer_id = pm_row.data[0]["stripe_customer_id"]
    try:
        pms = stripe_obj.PaymentMethod.list(customer=customer_id, type="card")
        if not pms.data or len(pms.data) == 0:
            return False, None
        payment_method_id = pms.data[0].id
    except Exception as e:
        logger.exception("List payment methods failed: %s", e)
        return False, None
    try:
        pi = stripe_obj.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=customer_id,
            payment_method=payment_method_id,
            off_session=True,
            confirm=True,
            metadata={"session_id": session_id, "parent_id": parent_id},
        )
        if pi.status != "succeeded":
            return False, None
    except Exception as e:
        logger.exception("Charge on end failed: %s", e)
        return False, None
    amount_final_val = amount_cents / 100.0
    if pay:
        sb_service.table("payments").update({
            "stripe_payment_intent_id": pi.id,
            "payment_status": "captured",
            "amount_estimated": float(total_amount),
            "amount_final": amount_final_val,
            "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
        }).eq("session_id", session_id).execute()
    else:
        sb_service.table("payments").insert({
            "session_id": session_id,
            "parent_id": parent_id,
            "amount_estimated": float(total_amount),
            "amount_final": amount_final_val,
            "currency": "usd",
            "stripe_payment_intent_id": pi.id,
            "payment_status": "captured",
        }).execute()
    _do_payout(stripe_obj, sb_service, session_id, session_data, amount_final_val)
    return True, amount_final_val


def _do_payout(stripe_obj, sb_service, session_id: str, session_data: dict, amount_final_val: float):
    """Create sitter payout (Stripe Connect transfer)."""
    sitter_id = session_data.get("sitter_id")
    if not sitter_id or amount_final_val <= 0:
        return
    try:
        fee_percent = float(os.getenv("PLATFORM_FEE_PERCENT", "15"))
        sitter_amount = round(amount_final_val * (1 - fee_percent / 100), 2)
        if sitter_amount >= 0.50:
            sa = sb_service.table("sitter_accounts").select("stripe_account_id").eq("sitter_id", sitter_id).execute()
            if sa.data and sa.data[0].get("stripe_account_id"):
                transfer_cents = int(Decimal(str(sitter_amount)) * 100)
                if transfer_cents >= 50:
                    tx = stripe_obj.Transfer.create(
                        amount=transfer_cents,
                        currency="usd",
                        destination=sa.data[0]["stripe_account_id"],
                        metadata={"session_id": session_id, "sitter_id": sitter_id},
                    )
                    sb_service.table("payouts").insert({
                        "session_id": session_id,
                        "sitter_id": sitter_id,
                        "amount": sitter_amount,
                        "stripe_transfer_id": tx.id,
                        "payout_status": "processing",
                    }).execute()
    except Exception as e:
        logger.exception("Payout create failed: %s", e)


# --- Capture (after session completed) ---
@router.post("/capture")
async def capture(
    body: CaptureInput,
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Capture the authorized payment for a session (after session completion). Parent or admin. Auto-called when session is ended."""
    stripe_obj = _stripe()
    if not stripe_obj:
        raise AppError(code="PAYMENT_UNAVAILABLE", message="Stripe is not configured", status_code=503)
    auth_token = credentials.credentials
    supabase = get_supabase_with_auth(auth_token)
    if not supabase:
        raise AppError(code="DB_NOT_AVAILABLE", message="Database unavailable", status_code=503)
    session_id = body.session_id
    session_resp = supabase.table("sessions").select("*").eq("id", session_id).single().execute()
    if not session_resp.data:
        raise AppError(code="SESSION_NOT_FOUND", message="Session not found", status_code=404)
    session_data = session_resp.data
    if session_data.get("status") != "completed":
        raise AppError(code="INVALID_STATUS", message="Session must be completed before capture", status_code=400)
    if current_user.role != "admin" and session_data.get("parent_id") != current_user.id:
        raise AppError(code="FORBIDDEN", message="Not allowed", status_code=403)
    captured, amount = do_capture_after_session_end(session_id)
    if not captured:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="No authorized payment to capture for this session",
            status_code=404,
        )
    return {"success": True, "status": "captured", "amountCaptured": amount}


# --- Webhook: payment_intent.succeeded ---
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    """Handle Stripe webhooks. On payment_intent.succeeded: set payment authorized, session paid and booked."""
    payload = await request.body()
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    stripe_obj = _stripe()
    if not stripe_obj or not endpoint_secret:
        return JSONResponse(content={"received": True}, status_code=200)

    try:
        event = stripe_obj.Webhook.construct_event(payload, stripe_signature or "", endpoint_secret)
    except Exception as e:
        logger.warning("Webhook signature verification failed: %s", e)
        return JSONResponse(content={"error": "invalid signature"}, status_code=400)

    if event.type == "payment_intent.succeeded":
        pi = event.data.object
        session_id = (pi.metadata or {}).get("session_id")
        if not session_id:
            return JSONResponse(content={"received": True}, status_code=200)
        sb = _get_supabase_service()
        if sb:
            try:
                sb.table("payments").update({
                    "payment_status": "authorized",
                    "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
                }).eq("stripe_payment_intent_id", pi.id).execute()
                sb.table("sessions").update({
                    "status": "booked",
                    "payment_status": "paid",
                    "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
                }).eq("id", session_id).execute()
            except Exception as e:
                logger.exception("Webhook DB update failed: %s", e)

    return JSONResponse(content={"received": True}, status_code=200)
