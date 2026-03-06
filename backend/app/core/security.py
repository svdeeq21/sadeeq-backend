# svdeeq-backend/app/core/security.py
#
# Two security concerns live here:
#   1. Webhook signature verification  — proves Evolution API sent the request
#   2. Admin API key check             — protects /leads and /health from public access

import hmac
import hashlib
from fastapi import Request, HTTPException, Security
from fastapi.security import APIKeyHeader
from app.core.config import get_settings

settings = get_settings()

# ── 1. Evolution API webhook signature verification ──────────────
#
# Evolution API signs each webhook POST with an HMAC-SHA256 of the
# raw request body, using your WEBHOOK_SECRET as the key.
# The signature is sent in the X-Hub-Signature-256 header as:
#   "sha256=<hex_digest>"
#
# We verify it here before touching any payload data.

async def verify_webhook_signature(request: Request) -> bytes:
    """
    Reads and returns the raw request body after verifying the
    Evolution API HMAC-SHA256 signature.

    Raises HTTP 401 if the signature is missing or invalid.
    Raises HTTP 400 if the body is empty.
    """
    raw_body = await request.body()

    if not raw_body:
        raise HTTPException(status_code=400, detail="Empty request body")

    signature_header = request.headers.get("x-hub-signature-256", "")

    if not signature_header:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Hub-Signature-256 header",
        )

    # Compute expected signature
    expected = hmac.new(
        key=settings.webhook_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    expected_header = f"sha256={expected}"

    # Constant-time comparison prevents timing attacks
    if not hmac.compare_digest(expected_header, signature_header):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook signature",
        )

    return raw_body


# ── 2. Admin API key (protects /leads, /health) ──────────────────
#
# Simple API key passed in the X-Admin-Key header.
# Used by the Next.js frontend (server-side routes only) and
# any internal tooling. Not exposed to the browser.

_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)


async def require_admin_key(api_key: str = Security(_api_key_header)) -> str:
    """
    FastAPI dependency. Use in any router that should be admin-only:

        @router.get("/leads")
        async def list_leads(key: str = Depends(require_admin_key)):
            ...
    """
    if not api_key or api_key != settings.admin_api_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing admin API key",
        )
    return api_key
