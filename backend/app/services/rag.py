# svdeeq-backend/app/services/rag.py

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.supabase import get_supabase
from app.models.schemas import KnowledgeChunk
from app.utils.logger import log

settings = get_settings()
_gemini = genai.Client(api_key=settings.gemini_api_key)


async def embed_text(text: str) -> list[float]:
    """
    Generates a vector embedding for the given text.
    Uses gemini-embedding-001 (3072 dimensions).
    """
    result = _gemini.models.embed_content(
        model=settings.embedding_model,
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
    )
    return result.embeddings[0].values


async def search_knowledge_base(
    query: str,
    threshold: float | None = None,
    limit:     int   | None = None,
) -> list[KnowledgeChunk]:
    """
    Embeds the query and performs cosine similarity search
    against the shared knowledge_base table.

    Returns a ranked list of KnowledgeChunk objects.
    Returns an empty list if no results meet the threshold.
    """
    db = get_supabase()

    threshold = threshold or settings.rag_match_threshold
    limit     = limit     or settings.rag_match_count

    embedding = await embed_text(query)

    result = db.rpc("match_knowledge_base", {
        "query_embedding":  embedding,
        "match_threshold":  threshold,
        "match_count":      limit,
        "filter_category":  None,
    }).execute()

    chunks = [KnowledgeChunk(**row) for row in (result.data or [])]

    await log.debug(
        "RAG_SEARCH",
        metadata={
            "query_preview": query[:80],
            "chunks_found":  len(chunks),
            "top_score":     chunks[0].similarity if chunks else 0,
        },
    )

    return chunks