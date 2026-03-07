"""
ingest_knowledge_base.py
Usage:
    pip install google-genai supabase python-dotenv
    python ingest_knowledge_base.py
"""

import json
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client

load_dotenv()

SUPABASE_URL    = os.environ["SUPABASE_URL"]
SUPABASE_KEY    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY  = os.environ["GEMINI_API_KEY"]
EMBEDDING_MODEL = "models/gemini-embedding-001"
KNOWLEDGE_FILE  = "knowledge_base.json"

client = genai.Client(api_key=GEMINI_API_KEY)
db = create_client(SUPABASE_URL, SUPABASE_KEY)


def embed(text: str) -> list:
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
    )
    return result.embeddings[0].values


def ingest():
    with open(KNOWLEDGE_FILE, "r") as f:
        chunks = json.load(f)

    print(f"Ingesting {len(chunks)} chunks...\n")

    db.table("knowledge_base").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("Cleared existing knowledge base.\n")

    for i, chunk in enumerate(chunks):
        title    = chunk["title"]
        category = chunk["category"]
        content  = chunk["content"]

        print(f"[{i+1}/{len(chunks)}] Embedding: {title}...")

        try:
            embedding = embed(content)

            db.table("knowledge_base").insert({
                "document_name": title,
                "category":      category,
                "content":       content,
                "embedding":     embedding,
                "chunk_index":   i,
                "is_active":     True,
            }).execute()

            print(f"  ✓ Stored.\n")

        except Exception as e:
            print(f"  ✗ Failed: {e}\n")

        time.sleep(0.5)

    print("Done! Knowledge base ingested successfully.")


if __name__ == "__main__":
    ingest()