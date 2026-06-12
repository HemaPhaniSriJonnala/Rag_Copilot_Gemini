"""
LLM Service — Google Gemini with streaming (google-genai SDK).
Free tier: gemini-2.5-flash  →  10 RPM, 250 req/day, no credit card needed.
"""

import os
import json
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv()
from google import genai
from google.genai import types

# Import from chroma_retriever (the active retriever), not the old TF-IDF one
from services.chroma_retriever import RetrievedChunk

MODEL = "gemini-2.5-flash"

SYSTEM_BASE = """You are RAG Copilot, an AI assistant that answers questions \
grounded in documents provided by the user.

Rules:
- Answer based on the retrieved context when provided.
- If the answer is not in the context, say so clearly and offer general knowledge.
- Cite the source document name when referencing specific facts.
- Format responses clearly with markdown: headers, bullets, code blocks.
- Never hallucinate document content that was not retrieved.
"""


def build_system_prompt(retrieved: list[RetrievedChunk]) -> str:
    if not retrieved:
        return SYSTEM_BASE + (
            "\n\nNo documents are loaded. Answer from general knowledge "
            "and remind the user to upload documents for grounded answers."
        )

    ctx_parts = []
    for i, chunk in enumerate(retrieved):
        ctx_parts.append(
            f'[Source {i+1}: "{chunk.doc_name}" — chunk {chunk.chunk_index + 1} '
            f"(relevance: {chunk.score:.0%})]\n{chunk.text}"
        )
    context = "\n\n---\n\n".join(ctx_parts)

    return (
        SYSTEM_BASE
        + f"\n\n## Retrieved Context\n\n{context}\n\n"
        "Answer the user's question using the context above."
    )


class LLMService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "Get a free key at https://aistudio.google.com/apikey "
                "then add it to backend/.env"
            )
        self.client = genai.Client(api_key=api_key)

    async def stream(
        self,
        query: str,
        history: list[dict],
        retrieved: list[RetrievedChunk],
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-compatible JSON lines."""

        system_prompt = build_system_prompt(retrieved)

        # Emit retrieved sources metadata first
        sources_payload = [
            {
                "doc_id": c.doc_id,
                "doc_name": c.doc_name,
                "chunk_index": c.chunk_index,
                "score": c.score,
                "preview": c.text[:120] + "…",
            }
            for c in retrieved
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload})}\n\n"

        # Build conversation history in Gemini's Content format
        # history items are dicts with keys: role, content, ts
        contents: list[types.Content] = []

        for m in history[-10:]:
            # m is a dict (from SQLite) — use m["role"], not m.role
            role = "model" if m["role"] == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=m["content"])],
                )
            )

        # Append current user query
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=query)],
            )
        )

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=1024,
        )

        # Stream tokens
        try:
            for chunk in self.client.models.generate_content_stream(
                model=MODEL,
                contents=contents,
                config=config,
            ):
                if chunk.text:
                    yield f"data: {json.dumps({'type': 'token', 'text': chunk.text})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'token', 'text': f'Error: {str(e)}'})} \n\n"