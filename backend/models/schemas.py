"""Pydantic request/response models."""

from pydantic import BaseModel
from typing import Optional


class AddTextRequest(BaseModel):
    content: str
    name: Optional[str] = None


class HistoryMessage(BaseModel):
    role: str        # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    query: str
    history: list[HistoryMessage] = []
    grounded: bool = True
    session_id: str = "default"


class DocumentResponse(BaseModel):
    id: str
    name: str
    preview: str
    chunk_count: int
    created_at: str

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    doc_count: int
    chunk_count: int
