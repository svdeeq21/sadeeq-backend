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

# async def verify_webhook_signature(request: Request) -> bytes:
#     raw_body = await request.body()

#     if not raw_body:
#         raise HTTPException(status_code=400, detail="Empty request body")

#     signature_header = request.headers.get("x-hub-signature-256", "")

#     if not signature_header:
#         raise HTTPException(
#             status_code=401,
#             detail="Missing X-Hub-Signature-256 header",
#         )

#     expected = f"sha256={settings.webhook_secret}"

#     if signature_header != expected:
#         raise HTTPException(
#             status_code=401,
#             detail="Invalid webhook signature",
#         )

#     return raw_body
# The one above is the main one, but due to some reasons i have to try this 

async def verify_webhook_signature(request: Request) -> bytes:
    raw_body = await request.body()
    
    # Evolution API sends the instance key in the 'apikey' header automatically
    token = request.headers.get("apikey")

    # This compares the incoming key to the one you have in Render
    if not token or token != settings.evolution_api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing Webhook API Key",
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
