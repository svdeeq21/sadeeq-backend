# svdeeq-backend/app/core/config.py
#
# UPDATED — replace your existing config.py with this full version.
# Added: Groq, HuggingFace, admin WhatsApp number, and SerpAPI key.

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Supabase ─────────────────────────────────────────────────
    supabase_url:              str
    supabase_service_role_key: str

    # ── Gemini (primary LLM) ─────────────────────────────────────
    gemini_api_key:  str
    gemini_model:    str = "gemini-1.5-flash"
    embedding_model: str = "models/text-embedding-004"

    # ── Groq (secondary LLM) ─────────────────────────────────────
    groq_api_key: str = ""                      # leave blank to skip Groq
    groq_model:   str = "llama3-8b-8192"

    # ── HuggingFace (tertiary LLM) ───────────────────────────────
    huggingface_api_key: str = ""               # leave blank to skip HuggingFace
    huggingface_model:   str = "mistralai/Mistral-7B-Instruct-v0.2"

    # ── Evolution API (WhatsApp) ─────────────────────────────────
    evolution_api_url:       str
    evolution_api_key:       str
    evolution_instance_name: str = "svdeeq-bot"
    webhook_secret:          str

    # ── Admin alerts ─────────────────────────────────────────────
    admin_api_key:           str
    admin_whatsapp_number:   str = ""           # e.g. +2348012345678 — leave blank to disable

    # ── App ──────────────────────────────────────────────────────
    app_env:   str = "development"
    log_level: str = "INFO"

    # ── RAG ──────────────────────────────────────────────────────
    rag_match_threshold: float = 0.70
    rag_match_count:     int   = 5

    # ── Rate limiting ────────────────────────────────────────────
    rate_limit_per_minute: int = 5

    # ── Memory ───────────────────────────────────────────────────
    memory_recent_window:    int = 6
    memory_summary_interval: int = 5

    # ── Scraper ──────────────────────────────────────────────────
    serpapi_key: str = ""                       # get free key at serpapi.com

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()