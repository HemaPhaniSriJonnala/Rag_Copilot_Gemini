"""
ChromaRetriever — uses Google GenAI embeddings instead of sentence-transformers.
Drops torch entirely, keeping the install tiny enough to deploy on Render free tier.
"""

import os
import chromadb
from google import genai
from dataclasses import dataclass
from services.document_store import DocumentStore

EMBEDDING_MODEL = "models/text-embedding-004"


def _embed(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings using Google GenAI embedding API."""
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
    )
    return [e.values for e in result.embeddings]


@dataclass
class RetrievedChunk:
    doc_id: str
    doc_name: str
    chunk_index: int
    text: str
    score: float


class ChromaRetriever:
    def __init__(self, store: DocumentStore):
        self.store = store

        # Use in-memory client — no disk persistence needed on Render
        self.client = chromadb.Client()

        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"},
        )

    def index_documents(self):
        chunks = self.store.get_chunks()

        # Clear and recreate collection
        try:
            self.client.delete_collection("documents")
        except Exception:
            pass

        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"},
        )

        if not chunks:
            return

        ids = [c.id for c in chunks]
        docs = [c.text for c in chunks]

        # Embed in batches of 100 (API limit)
        embeddings = []
        batch_size = 100
        for i in range(0, len(docs), batch_size):
            batch = docs[i : i + batch_size]
            embeddings.extend(_embed(batch))

        metadatas = [
            {
                "doc_id": c.doc_id,
                "doc_name": c.doc_name,
                "chunk_index": c.chunk_index,
            }
            for c in chunks
        ]

        self.collection.add(
            ids=ids,
            documents=docs,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def retrieve(self, query: str, k: int = 3) -> list[RetrievedChunk]:
        if self.collection.count() == 0:
            return []

        query_embedding = _embed([query])

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=min(k, self.collection.count()),
        )

        retrieved = []
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        for doc, meta, distance in zip(docs, metas, distances):
            retrieved.append(
                RetrievedChunk(
                    doc_id=meta["doc_id"],
                    doc_name=meta["doc_name"],
                    chunk_index=meta["chunk_index"],
                    text=doc,
                    score=round(1 - distance, 4),
                )
            )

        return retrieved