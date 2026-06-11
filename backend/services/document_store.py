"""
DocumentStore — unified in-memory storage for documents and chunks.

Combines both versions:
- Old: add_file(), add_text(), remove(), get_filename(), list_documents(), stats()
- New: add_document(), remove_document(), get_chunks(), total_chunks()
  + PDF and DOCX extraction built-in

Both old and new method names work, so main.py and chroma_retriever.py
don't need any changes.
"""

import uuid
import io
from dataclasses import dataclass, field
from datetime import datetime


# ══════════════════════════════════════════════════════════════════════════════
# Data models
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Chunk:
    id:          str
    doc_id:      str
    doc_name:    str       # used by ChromaRetriever
    chunk_index: int       # was .index in old version
    text:        str

    # back-compat alias so old code using .index still works
    @property
    def index(self) -> int:
        return self.chunk_index


@dataclass
class Document:
    id:         str
    name:       str        # canonical field
    preview:    str        # first 200 chars
    chunk_count: int
    created_at: str

    # back-compat aliases so old code using .filename still works
    @property
    def filename(self) -> str:
        return self.name

    @property
    def chunks(self) -> list:
        # returns empty list by default; real chunks are in DocumentStore._chunks
        return []


# ══════════════════════════════════════════════════════════════════════════════
# Text extractors
# ══════════════════════════════════════════════════════════════════════════════

def _extract_pdf(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages  = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p for p in pages if p.strip())


def _extract_docx(content: bytes) -> str:
    from docx import Document as DocxDoc
    doc   = DocxDoc(io.BytesIO(content))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(c.text.strip() for c in row.cells)
            if row_text.strip(" |"):
                parts.append(row_text)
    return "\n".join(parts)


def _extract(filename: str, content: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        return _extract_pdf(content)
    if ext == "docx":
        return _extract_docx(content)
    return content.decode("utf-8", errors="ignore")


# ══════════════════════════════════════════════════════════════════════════════
# Chunker
# ══════════════════════════════════════════════════════════════════════════════

CHUNK_SIZE    = 400   # words per chunk
CHUNK_OVERLAP = 80    # overlap between consecutive chunks


def _chunk_text(doc_id: str, doc_name: str, text: str) -> list[Chunk]:
    words  = text.split()
    step   = CHUNK_SIZE - CHUNK_OVERLAP
    chunks = []
    for i, start in enumerate(range(0, len(words), step)):
        chunk_text = " ".join(words[start : start + CHUNK_SIZE])
        if chunk_text.strip():
            chunks.append(
                Chunk(
                    id          = str(uuid.uuid4()),
                    doc_id      = doc_id,
                    doc_name    = doc_name,
                    chunk_index = i,
                    text        = chunk_text,
                )
            )
    return chunks


# ══════════════════════════════════════════════════════════════════════════════
# DocumentStore
# ══════════════════════════════════════════════════════════════════════════════

class DocumentStore:
    def __init__(self):
        self._docs:   dict[str, Document] = {}
        self._chunks: list[Chunk]         = []

    # ── internal ──────────────────────────────────────────────────────────────

    def _create(self, name: str, text: str) -> Document:
        doc_id  = str(uuid.uuid4())
        chunks  = _chunk_text(doc_id, name, text)
        self._chunks.extend(chunks)

        doc = Document(
            id          = doc_id,
            name        = name,
            preview     = text[:200],
            chunk_count = len(chunks),
            created_at  = datetime.utcnow().isoformat(),
        )
        self._docs[doc_id] = doc
        return doc

    # ── add — NEW style (used by new main.py) ─────────────────────────────────

    def add_document(self, name: str, content: str) -> Document:
        """New-style add: accepts already-extracted text string."""
        return self._create(name, content)

    # ── add — OLD style (used by old main.py / other services) ───────────────

    def add_file(self, filename: str, content: bytes) -> Document:
        """Old-style add: accepts raw bytes, extracts text internally."""
        text = _extract(filename, content)
        return self._create(filename, text)

    def add_text(self, title: str, text: str) -> Document:
        """Old-style add: plain text with a title."""
        return self._create(title, text)

    # ── remove ────────────────────────────────────────────────────────────────

    def remove_document(self, doc_id: str) -> bool:
        """New-style remove: returns True/False."""
        if doc_id not in self._docs:
            return False
        del self._docs[doc_id]
        self._chunks = [c for c in self._chunks if c.doc_id != doc_id]
        return True

    def remove(self, doc_id: str) -> None:
        """Old-style remove: silent no-op if not found."""
        self.remove_document(doc_id)

    # ── query ─────────────────────────────────────────────────────────────────

    def list_documents(self) -> list[Document]:
        return list(self._docs.values())

    def get_chunks(self) -> list[Chunk]:
        """Used by ChromaRetriever.index_documents()."""
        return self._chunks

    def total_chunks(self) -> int:
        return len(self._chunks)

    def get_filename(self, doc_id: str) -> str:
        """Used by main.py to attach filenames to source citations."""
        doc = self._docs.get(doc_id)
        return doc.name if doc else "unknown"

    def stats(self) -> dict:
        """Old-style stats endpoint."""
        return {"documents": len(self._docs), "chunks": len(self._chunks)}