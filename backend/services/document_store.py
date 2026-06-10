"""
Document Store — in-memory storage for documents and chunks.
Replace the dict store with a real DB (SQLite / Postgres) for production.
"""

import uuid
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from pypdf import PdfReader
import io
from docx import Document as DocxDocument

def extract_text(filename: str, content: bytes) -> str:
    if filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    if filename.endswith(".docx"):
        return extract_docx(content)
    return content.decode("utf-8", errors="ignore")


def extract_docx(content: bytes) -> str:
    doc = DocxDocument(io.BytesIO(content))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(c.text for c in row.cells))
    return "\n".join(p for p in parts if p.strip())


CHUNK_SIZE = 400     # words per chunk
CHUNK_OVERLAP = 80   # words of overlap between chunks


@dataclass
class Chunk:
    id: str
    doc_id: str
    doc_name: str
    chunk_index: int
    text: str


@dataclass
class Document:
    id: str
    name: str
    preview: str           # first 200 chars
    chunk_count: int
    created_at: str


class DocumentStore:
    def __init__(self):
        self._docs: dict[str, Document] = {}
        self._chunks: list[Chunk] = []

    # ── Internal ────────────────────────────────────────────────────────

    def _chunk_text(self, text: str) -> list[str]:
        words = text.split()
        chunks = []
        step = CHUNK_SIZE - CHUNK_OVERLAP
        for i in range(0, len(words), step):
            chunk = " ".join(words[i : i + CHUNK_SIZE])
            if chunk.strip():
                chunks.append(chunk)
        return chunks

    # ── Public API ───────────────────────────────────────────────────────

    def add_document(self, name: str, content: str) -> Document:
        doc_id = str(uuid.uuid4())
        raw_chunks = self._chunk_text(content)

        new_chunks = [
            Chunk(
                id=str(uuid.uuid4()),
                doc_id=doc_id,
                doc_name=name,
                chunk_index=i,
                text=text,
            )
            for i, text in enumerate(raw_chunks)
        ]
        self._chunks.extend(new_chunks)

        doc = Document(
            id=doc_id,
            name=name,
            preview=content[:200],
            chunk_count=len(new_chunks),
            created_at=datetime.utcnow().isoformat(),
        )
        self._docs[doc_id] = doc
        return doc

    def remove_document(self, doc_id: str) -> bool:
        if doc_id not in self._docs:
            return False
        del self._docs[doc_id]
        self._chunks = [c for c in self._chunks if c.doc_id != doc_id]
        return True

    def list_documents(self) -> list[Document]:
        return list(self._docs.values())

    def get_chunks(self) -> list[Chunk]:
        return self._chunks

    def total_chunks(self) -> int:
        return len(self._chunks)
