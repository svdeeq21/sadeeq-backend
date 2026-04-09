# svdeeq-backend/app/models/schemas.py
#
# All Pydantic models used across routers and services.
# Single source of truth for request/response shapes.

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, Union
from datetime import datetime
from uuid import UUID


# ── Webhook payload (Evolution API → FastAPI) ────────────────────
#
# Evolution API sends a webhook for every WA event.
# We only care about message events here.
#
# Evolution quirks we handle:
#   1. `data` is sometimes a LIST (batch delivery events) — unwrapped to first item
#   2. Some events (read receipts, status updates) are missing `key` and `messageType`
#      — those fields are Optional; webhook.py drops them early.

class WAMessageData(BaseModel):
    """The message object nested inside the webhook payload."""
    key:         Optional[dict] = None  # contains remoteJid and message id
    message:     Optional[dict] = None  # contains conversation text or media
    messageType: Optional[str]  = None  # e.g. "conversation", "imageMessage"
    pushName:    Optional[str]  = None  # contact display name
    status:      Optional[str]  = None


class WAWebhookPayload(BaseModel):
    """
    Top-level Evolution API webhook payload.
    event: the event type, e.g. "messages.upsert"
    instance: your Evolution instance name
    data: the actual message data
    """
    event:    str
    instance: str
    data:     WAMessageData

    @field_validator("data", mode="before")
    @classmethod
    def unwrap_data_list(cls, v):
        """
        Evolution API sometimes sends `data` as a list (batch events).
        Unwrap to first item so the rest of the schema validates normally.
        """
        if isinstance(v, list):
            return v[0] if v else {}
        return v


# ── Lead schemas ─────────────────────────────────────────────────

class LeadBase(BaseModel):
    name:          str
    phone_number:  str
    status:        str
    ai_paused:     bool
    location:      Optional[str] = None
    budget_range:  Optional[str] = None
    interest_type: Optional[str] = None


class LeadResponse(LeadBase):
    id:           UUID
    created_at:   datetime
    updated_at:   datetime
    messages:     Optional[int] = 0   # joined from sessions.message_count

    model_config = {"from_attributes": True}


class LeadPauseUpdate(BaseModel):
    """PATCH /leads/{lead_id}/pause"""
    ai_paused: bool


# ── Message schemas ───────────────────────────────────────────────

class MessageRecord(BaseModel):
    """What gets written to the messages table."""
    lead_id:        UUID
    sender:         Literal["USER", "AI", "SYSTEM"]
    content:        str
    message_type:   Literal["TEXT", "IMAGE", "AUDIO", "DOCUMENT", "SYSTEM_EVENT"] = "TEXT"
    wa_message_id:  Optional[str] = None
    latency_ms:     Optional[int] = None


# ── RAG schemas ───────────────────────────────────────────────────

class KnowledgeChunk(BaseModel):
    """A single result from match_knowledge_base()."""
    id:            UUID
    document_name: str
    chunk_index:   int
    content:       str
    category:      Optional[str] = None
    similarity:    float


# ── Pipeline internal context ─────────────────────────────────────

class ConversationContext(BaseModel):
    """
    Assembled by memory.py and passed into llm.py.
    Contains everything needed to build the LLM prompt.
    """
    lead_id:       UUID
    lead_name:     str
    summary:       Optional[str] = None        # persistent conversation summary
    recent:        list[dict]   = Field(default_factory=list)  # last N messages
    rag_chunks:    list[KnowledgeChunk] = Field(default_factory=list)
    message_count: int = 0


# ── Health check ──────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:      str
    environment: str
    db:          str
    wa:          str
    llm_quota:   Optional[str] = None
