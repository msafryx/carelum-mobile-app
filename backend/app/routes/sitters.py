"""
Sitter payout account: Stripe Connect Express onboarding.
Sitters must complete onboarding before they can accept sessions (enforced in session accept flow).
"""
import os
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import verify_token, CurrentUser, security
from app.utils.error_handler import handle_error, AppError
from app.utils.database import get_supabase_with_auth
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
router = APIRouter()


def _stripe():
    import stripe
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        return None
    stripe.api_key = key
    return stripe


def _get_supabase_service():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        from app.utils.database import get_supabase
        return get_supabase()
    from supabase import create_client
    return create_client(url, key)


class CreateStripeAccountResponse(BaseModel):
    accountId: Optional[str] = None
    alreadyExists: bool = False


class OnboardingLinkResponse(BaseModel):
    url: str


# --- Create Stripe Connect Express account ---
@router.post("/create-stripe-account", response_model=CreateStripeAccountResponse)
async def create_stripe_account(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create Stripe Connect Express account for sitter. Store stripe_account_id in sitter_accounts."""
    if current_user.role != "sitter":
        raise AppError(
            code="FORBIDDEN",
            message="Only sitters can create payout accounts",
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

    existing = supabase.table("sitter_accounts").select("*").eq("sitter_id", current_user.id).execute()
    if existing.data and len(existing.data) > 0:
        row = existing.data[0]
        if row.get("stripe_account_id"):
            return CreateStripeAccountResponse(accountId=row["stripe_account_id"], alreadyExists=True)
    else:
        supabase.table("sitter_accounts").insert({
            "sitter_id": current_user.id,
            "onboarding_status": "not_started",
        }).execute()
        existing = supabase.table("sitter_accounts").select("*").eq("sitter_id", current_user.id).execute()
        if not existing.data:
            raise AppError(code="DB_ERROR", message="Failed to create sitter_accounts row", status_code=500)

    row = existing.data[0]
    if row.get("stripe_account_id"):
        return CreateStripeAccountResponse(accountId=row["stripe_account_id"], alreadyExists=True)

    try:
        account = stripe_obj.Account.create(
            type="express",
            country="US",
            email=current_user.email or "",
            metadata={"carelum_sitter_id": current_user.id},
        )
    except Exception as e:
        logger.exception("Stripe Connect account create failed")
        raise AppError(code="STRIPE_ERROR", message=str(e), status_code=502)

    sb = _get_supabase_service()
    if sb:
        sb.table("sitter_accounts").update({
            "stripe_account_id": account.id,
            "onboarding_status": "pending",
            "updated_at": __import__("datetime").datetime.utcnow().isoformat(),
        }).eq("sitter_id", current_user.id).execute()

    return CreateStripeAccountResponse(accountId=account.id, alreadyExists=False)


# --- Get onboarding link (Stripe Connect Express) ---
@router.post("/onboarding-link", response_model=OnboardingLinkResponse)
async def create_onboarding_link(
    current_user: CurrentUser = Depends(verify_token),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Return Stripe Connect Express onboarding URL. Sitter completes identity + bank + tax there."""
    if current_user.role != "sitter":
        raise AppError(
            code="FORBIDDEN",
            message="Only sitters can get onboarding link",
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

    row = supabase.table("sitter_accounts").select("stripe_account_id").eq("sitter_id", current_user.id).execute()
    if not row.data or not row.data[0].get("stripe_account_id"):
        raise AppError(
            code="NO_ACCOUNT",
            message="Create a payout account first (Connect Bank Account)",
            status_code=400,
        )
    account_id = row.data[0]["stripe_account_id"]

    base_url = os.getenv("FRONTEND_URL", "https://app.carelum.com")
    return_url = f"{base_url.rstrip('/')}/sitter/profile?onboarding=return"
    refresh_url = f"{base_url.rstrip('/')}/sitter/profile?onboarding=refresh"

    try:
        link = stripe_obj.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
    except Exception as e:
        logger.exception("AccountLink create failed")
        raise AppError(code="STRIPE_ERROR", message=str(e), status_code=502)

    return OnboardingLinkResponse(url=link.url)
