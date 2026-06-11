"""
RAG Copilot — FastAPI Backend (Gemini edition)
FIX: main.py was double-emitting sources and re-wrapping llm tokens.
     llm.py already emits all SSE events — main.py now just passes them through.
"""

import os
import io
import asyncio

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()

from services.document_store import DocumentStore
from services.chroma_retriever import ChromaRetriever
from services.llm import LLMService
from services.history_store import HistoryStore
from models.schemas import AddTextRequest, ChatRequest, DocumentResponse, StatsResponse

app = FastAPI(title="RAG Copilot API (Gemini)", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

doc_store  = DocumentStore()
retriever  = ChromaRetriever(doc_store)
retriever.index_documents()
llm        = LLMService()
hist_store = HistoryStore()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Documents ──────────────────────────────────────────────────────────────────

@app.get("/api/docs", response_model=list[DocumentResponse])
def list_docs():
    return doc_store.list_documents()


@app.post("/api/docs/upload", response_model=DocumentResponse)
async def upload_file(file: UploadFile = File(...)):
    content  = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            text   = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

    elif filename.endswith(".docx"):
        try:
            from docx import Document as DocxDoc
            doc_obj = DocxDoc(io.BytesIO(content))
            parts   = [p.text for p in doc_obj.paragraphs if p.text.strip()]
            for table in doc_obj.tables:
                for row in table.rows:
                    row_text = " | ".join(c.text.strip() for c in row.cells)
                    if row_text.strip(" |"):
                        parts.append(row_text)
            text = "\n".join(parts)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read DOCX: {e}")

    else:
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            raise HTTPException(status_code=400, detail="Could not decode file as text")

    doc = doc_store.add_document(name=file.filename, content=text)
    retriever.index_documents()
    return doc


@app.post("/api/docs/text", response_model=DocumentResponse)
def add_text(body: AddTextRequest):
    doc = doc_store.add_document(name=body.name or "snippet.txt", content=body.content)
    retriever.index_documents()
    return doc


@app.delete("/api/docs/{doc_id}")
def delete_doc(doc_id: str):
    if not doc_store.remove_document(doc_id):
        raise HTTPException(status_code=404, detail="Document not found")
    retriever.index_documents()
    return {"deleted": doc_id}


@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    return StatsResponse(
        doc_count=len(doc_store.list_documents()),
        chunk_count=doc_store.total_chunks(),
    )


@app.get("/api/retrieve")
def retrieve_debug(q: str, k: int = 3):
    return retriever.retrieve(q, k=k)


# ── Chat ───────────────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(body: ChatRequest):
    retrieved = []
    if body.grounded and doc_store.total_chunks() > 0:
        retrieved = retriever.retrieve(body.query, k=3)

    async def stream():
        full_reply = []

        # ✅ FIX: llm.stream() already emits all SSE events (sources + tokens).
        #         Just pass them through. Don't re-wrap or double-emit.
        async for sse_line in llm.stream(
            query=body.query,
            history=body.history,
            retrieved=retrieved,
        ):
            # Collect token text for history persistence
            if '"type": "token"' in sse_line or '"type":"token"' in sse_line:
                try:
                    import json
                    data = json.loads(sse_line.replace("data: ", "", 1).strip())
                    full_reply.append(data.get("text", ""))
                except Exception:
                    pass

            yield sse_line
            await asyncio.sleep(0)

        # Send done event
        import json
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

        # Persist to history
        hist_store.append(body.session_id, "user",      body.query)
        hist_store.append(body.session_id, "assistant", "".join(full_reply))

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── History ────────────────────────────────────────────────────────────────────

@app.get("/api/history/{session_id}")
def get_history(session_id: str):
    return hist_store.get(session_id)

@app.delete("/api/history/{session_id}")
def clear_history(session_id: str):
    hist_store.clear(session_id)
    return {"cleared": session_id}

@app.get("/api/history")
def list_sessions():
    return hist_store.list_sessions()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
