# svdeeq-backend/app/core/supabase.py
#
# Single Supabase client using the service_role key.
# This bypasses RLS — it is ONLY used server-side in FastAPI.
# Never pass this client or its key to the frontend.

from supabase import create_client, Client
from functools import lru_cache
from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """
    Cached Supabase client — constructed once at startup.
    Use:  from app.core.supabase import get_supabase
          db = get_supabase()
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
