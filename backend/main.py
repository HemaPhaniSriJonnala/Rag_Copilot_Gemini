"""
RAG Copilot — FastAPI Backend (Gemini edition)
Free tier: gemini-2.5-flash via Google AI Studio key (no credit card).
"""


from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()   # load GEMINI_API_KEY from .env before importing LLMService

from services.document_store import DocumentStore
from services.chroma_retriever import ChromaRetriever
from services.llm import LLMService
from models.schemas import (
    AddTextRequest,
    ChatRequest,
    DocumentResponse,
    StatsResponse,
)

app = FastAPI(title="RAG Copilot API (Gemini)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

doc_store = DocumentStore()
retriever = ChromaRetriever(doc_store)
retriever.index_documents()

llm = LLMService()


@app.get("/api/docs", response_model=list[DocumentResponse])
def list_docs():
    return doc_store.list_documents()


@app.post("/api/docs/upload", response_model=DocumentResponse)
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode file as text")
    doc = doc_store.add_document(
        name=file.filename,
        content=text
        )
    retriever.index_documents()
    return doc


@app.post("/api/docs/text", response_model=DocumentResponse)
def add_text(body: AddTextRequest):
        doc = doc_store.add_document(
            name=body.name or "snippet.txt",
            content=body.content
            )
        retriever.index_documents()
        return doc


@app.delete("/api/docs/{doc_id}")
def delete_doc(doc_id: str):    
    if not doc_store.remove_document(doc_id):
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )
    retriever.index_documents()

    return {"deleted": doc_id}


@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    return StatsResponse(
        doc_count=len(doc_store.list_documents()),
        chunk_count=doc_store.total_chunks(),
    )


@app.post("/api/chat")
async def chat(body: ChatRequest):
    retrieved = []
    if body.grounded and doc_store.total_chunks() > 0:
        retrieved = retriever.retrieve(body.query, k=3)

    async def stream():
        async for token in llm.stream(
            query=body.query,
            history=body.history,
            retrieved=retrieved,
        ):
            yield token

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/api/retrieve")
def retrieve(q: str, k: int = 3):
    """Debug: see raw ChromaDB retrieval results."""
    return retriever.retrieve(q, k=k)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
