import chromadb
from sentence_transformers import SentenceTransformer

from dataclasses import dataclass
from services.document_store import DocumentStore


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

        self.model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

        self.client = chromadb.PersistentClient(
            path="./chroma_db"
        )

        self.collection = self.client.get_or_create_collection(
            name="documents"
        )

    def index_documents(self):
        chunks = self.store.get_chunks()

        # Clear entire collection first
        try:
            self.client.delete_collection("documents")
        except:
            pass

        self.collection = self.client.get_or_create_collection(
            name="documents"
        )

        if not chunks:
            return

        ids = [c.id for c in chunks]
        docs = [c.text for c in chunks]

        embeddings = self.model.encode(
            docs
        ).tolist()

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

    def retrieve(self, query: str, k: int = 3):

        query_embedding = self.model.encode(
            [query]
        ).tolist()

        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=k,
        )

        retrieved = []

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        for doc, meta, distance in zip(
            docs,
            metas,
            distances,
        ):
            retrieved.append(
                RetrievedChunk(
                    doc_id=meta["doc_id"],
                    doc_name=meta["doc_name"],
                    chunk_index=meta["chunk_index"],
                    text=doc,
                    score=1 - distance,
                )
            )

        return retrieved