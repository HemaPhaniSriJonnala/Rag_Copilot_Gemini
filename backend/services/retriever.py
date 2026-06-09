"""
Retriever — TF-IDF cosine similarity search over document chunks.

Upgrade path:
  - Swap with sentence-transformers + FAISS for dense retrieval
  - Or use ChromaDB / Pinecone for managed vector storage
"""

import math
import re
from dataclasses import dataclass
from services.document_store import DocumentStore, Chunk


STOPWORDS = {
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","being","have","has","had","do","does",
    "did","will","would","could","should","may","might","shall","can","not",
    "no","nor","so","yet","both","either","whether","that","this","these",
    "those","than","then","when","where","which","who","whom","how","what",
    "its","it","i","we","you","he","she","they","my","your","our","their",
}


def tokenize(text: str) -> list[str]:
    tokens = re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS]


def term_freq(tokens: list[str]) -> dict[str, float]:
    tf: dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    n = len(tokens) or 1
    return {t: count / n for t, count in tf.items()}


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in b)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    if not mag_a or not mag_b:
        return 0.0
    return dot / (mag_a * mag_b)


@dataclass
class RetrievedChunk:
    doc_id: str
    doc_name: str
    chunk_index: int
    text: str
    score: float


class Retriever:
    def __init__(self, store: DocumentStore):
        self.store = store

    def _build_idf(self, chunks: list[Chunk]) -> dict[str, float]:
        n = len(chunks)
        df: dict[str, int] = {}
        for chunk in chunks:
            terms = set(tokenize(chunk.text))
            for t in terms:
                df[t] = df.get(t, 0) + 1
        return {
            t: math.log((n + 1) / (count + 1)) + 1
            for t, count in df.items()
        }

    def _tfidf_vec(
        self, tokens: list[str], idf: dict[str, float]
    ) -> dict[str, float]:
        tf = term_freq(tokens)
        return {t: tf[t] * idf.get(t, 1.0) for t in tf}

    def retrieve(self, query: str, k: int = 3) -> list[RetrievedChunk]:
        chunks = self.store.get_chunks()
        if not chunks:
            return []

        idf = self._build_idf(chunks)
        q_tokens = tokenize(query)
        q_vec = self._tfidf_vec(q_tokens, idf)

        scored: list[RetrievedChunk] = []
        for chunk in chunks:
            c_tokens = tokenize(chunk.text)
            c_vec = self._tfidf_vec(c_tokens, idf)
            score = cosine(q_vec, c_vec)
            if score > 0:
                scored.append(
                    RetrievedChunk(
                        doc_id=chunk.doc_id,
                        doc_name=chunk.doc_name,
                        chunk_index=chunk.chunk_index,
                        text=chunk.text,
                        score=round(score, 4),
                    )
                )

        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:k]
