# svdeeq-backend/app/services/rag.py
#
# RAG pipeline — two steps:
#   1. Embed the user's message using Google's text-embedding-004
#   2. Search knowledge_base via cosine similarity (Supabase RPC)
#
# The knowledge base is shared across ALL leads.
# What makes each response unique is the conversation context
# passed in from memory.py, not per-lead knowledge filtering.

import google.generativeai as genai
from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.models.schemas import KnowledgeChunk
from app.utils.logger import log

settings = get_settings()
genai.configure(api_key=settings.gemini_api_key)


async def embed_text(text: str) -> list[float]:
    """
    Generates a vector embedding for the given text.
    Uses Google's text-embedding-004 (768 dimensions).
    """
    result = genai.embed_content(
        model=settings.embedding_model,
        content=text,
        task_type="retrieval_query",
    )
    return result["embedding"]


async def search_knowledge_base(
    query: str,
    threshold: float | None = None,
    limit:     int   | None = None,
) -> list[KnowledgeChunk]:
    """
    Embeds the query and performs cosine similarity search
    against the shared knowledge_base table.

    Returns a ranked list of KnowledgeChunk objects.
    Returns an empty list if no results meet the threshold —
    the pipeline treats this as a low-confidence signal.
    """
    db = get_supabase()

    threshold = threshold or settings.rag_match_threshold
    limit     = limit     or settings.rag_match_count

    # Step 1: embed the incoming user message
    embedding = await embed_text(query)

    # Step 2: vector search via Supabase RPC (defined in 03_functions.sql)
    result = db.rpc("match_knowledge_base", {
        "query_embedding":  embedding,
        "match_threshold":  threshold,
        "match_count":      limit,
        "filter_category":  None,   # search all categories
    }).execute()

    chunks = [KnowledgeChunk(**row) for row in (result.data or [])]

    await log.debug(
        "RAG_SEARCH",
        metadata={
            "query_preview":  query[:80],
            "chunks_found":   len(chunks),
            "top_score":      chunks[0].similarity if chunks else 0,
        },
    )

    return chunks
