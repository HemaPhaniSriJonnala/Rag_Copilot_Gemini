# RAG Copilot — 100% Free with Google Gemini

Chat with your documents using Google's Gemini API — **no credit card, no paid plan**.

```
Stack: FastAPI · React + Vite · TF-IDF retrieval · Gemini 2.5 Flash · SSE streaming
```

---

## Free Tier Limits (as of June 2026)

| Model              | Req/min | Req/day | Cost  |
|--------------------|---------|---------|-------|
| gemini-2.5-flash   | 10 RPM  | 250/day | FREE  |
| gemini-2.5-flash-lite | 15 RPM | 1,000/day | FREE |

No credit card needed. Just a Google account.

---

## Step-by-Step Setup

### STEP 1 — Get your free Gemini API key

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **"Create API key"**
4. Select **"Create API key in new project"**
5. Copy the key (starts with `AIza...`)

That's it — no billing setup, no credit card.

---

### STEP 2 — Download / clone the project

```bash
# If you have git:
git clone <your-repo-url>
cd rag-copilot

# Or just unzip the downloaded folder and cd into it
cd rag-copilot
```

---

### STEP 3 — Backend setup

You need **Python 3.10+** installed. Check with: `python3 --version`

```bash
# Go into the backend folder
cd backend

# Create a virtual environment (keeps dependencies isolated)
python3 -m venv .venv

# Activate it:
# On Mac/Linux:
source .venv/bin/activate
# On Windows (Command Prompt):
.venv\Scripts\activate.bat
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install all dependencies
pip install -r requirements.txt
```

You should see packages installing. This takes about 30 seconds.

---

### STEP 4 — Add your API key

```bash
# Still inside the backend/ folder:
cp .env.example .env
```

Now open `backend/.env` in any text editor and replace the placeholder:

```
GEMINI_API_KEY=AIza-your-actual-key-here
```

Save the file.

---

### STEP 5 — Start the backend server

```bash
# Make sure you're in backend/ with venv active
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

Leave this terminal open. Open a new terminal for the next step.

---

### STEP 6 — Frontend setup

You need **Node.js 18+** installed. Check with: `node --version`

If you don't have it: download from https://nodejs.org (LTS version)

```bash
# Open a NEW terminal, go to the frontend folder
cd rag-copilot/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

You should see:
```
  VITE v5.x  ready in 500ms
  ➜  Local:   http://localhost:5173/
```

---

### STEP 7 — Open the app

Go to **http://localhost:5173** in your browser.

You should see RAG Copilot running. Try:
1. Click "Drop files or click to browse" → upload a `.txt` or `.md` file
2. Type a question in the chat box
3. Press Enter — Gemini will answer based on your document

---

## Project Structure

```
rag-copilot/
├── backend/
│   ├── main.py                    # FastAPI routes
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Copy to .env, add your key
│   ├── models/
│   │   └── schemas.py             # Pydantic request/response types
│   └── services/
│       ├── document_store.py      # In-memory doc + chunk storage
│       ├── retriever.py           # TF-IDF cosine similarity search
│       └── llm.py                 # Gemini streaming integration ← changed
│
└── frontend/
    ├── index.html
    ├── vite.config.js             # Proxies /api → localhost:8000
    ├── package.json
    └── src/
        ├── main.jsx               # React entry point
        ├── App.jsx                # Root component
        ├── index.css              # Global styles + markdown
        ├── components/
        │   ├── Header.jsx / .module.css
        │   ├── Sidebar.jsx / .module.css
        │   └── ChatPanel.jsx / .module.css
        ├── hooks/
        │   ├── useDocuments.js    # Upload/delete/list state
        │   └── useChat.js         # Streaming chat state
        └── utils/
            └── api.js             # All fetch + SSE calls
```

---

## How RAG Works (the pipeline)

```
1. You upload a file
         │
         ▼
   DocumentStore splits it into 400-word overlapping chunks
   (overlap = 80 words to preserve context at boundaries)

2. You ask a question
         │
         ▼
   Retriever.retrieve(query, k=3)
    ├── tokenize query (remove stopwords)
    ├── compute TF-IDF vectors for all chunks
    ├── score each chunk with cosine similarity
    └── return top-3 most relevant chunks

3. LLMService.stream(query, history, retrieved_chunks)
    ├── build system prompt with retrieved context injected
    ├── call Gemini 2.5 Flash with streaming enabled
    ├── emit SSE: { type: "sources" }  ← attribution block
    ├── emit SSE: { type: "token" }    ← streamed word by word
    └── emit SSE: { type: "done" }

4. Frontend ChatPanel
    ├── receives sources → shows which chunks were used + scores
    ├── receives tokens → appends to bubble in real time
    └── receives done → marks message complete
```

---

## Changing the Gemini model

In `backend/services/llm.py`, line 12:

```python
MODEL = "gemini-2.5-flash"        # default (10 RPM free)
# MODEL = "gemini-2.5-flash-lite"  # more quota (15 RPM, 1000/day)
# MODEL = "gemini-2.5-pro"         # smarter (5 RPM, 100/day free)
```

---

## Troubleshooting

**"GEMINI_API_KEY environment variable is not set"**
→ Make sure you created `backend/.env` (not `.env.example`) and it has your real key.

**429 Too Many Requests**
→ You hit the free rate limit. Wait 1 minute and try again, or switch to `gemini-2.5-flash-lite` for higher quota.

**"ModuleNotFoundError: No module named 'google'"**
→ Your venv isn't active. Run `source .venv/bin/activate` (Mac/Linux) or `.venv\Scripts\activate` (Windows).

**"npm: command not found"**
→ Install Node.js from https://nodejs.org

**Frontend can't reach backend (network error)**
→ Make sure the backend is running on port 8000 and frontend on 5173. The Vite proxy handles `/api` → `localhost:8000` automatically.

**EU/UK users**
→ The free tier may be restricted in your region. Use a VPN or enable billing (first $300 is free credit on Google Cloud).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/docs` | List all documents |
| POST | `/api/docs/upload` | Upload a file (multipart) |
| POST | `/api/docs/text` | Add a text snippet |
| DELETE | `/api/docs/{id}` | Remove a document |
| GET | `/api/stats` | Document + chunk counts |
| POST | `/api/chat` | Stream a response (SSE) |
| GET | `/api/retrieve?q=...&k=3` | Debug: raw retrieval results |

Interactive API docs: http://localhost:8000/docs

---

## Upgrading retrieval (optional)

The current retriever uses TF-IDF (keyword matching). For semantic/meaning-based search:

```bash
pip install sentence-transformers chromadb
```

Then replace the `Retriever` class body:

```python
from sentence_transformers import SentenceTransformer
import chromadb

model = SentenceTransformer("all-MiniLM-L6-v2")  # free, runs locally
chroma = chromadb.Client()
collection = chroma.create_collection("docs")

# When adding chunks:
embeddings = model.encode([c.text for c in chunks]).tolist()
collection.add(documents=[c.text for c in chunks],
               embeddings=embeddings,
               ids=[c.id for c in chunks])

# When retrieving:
results = collection.query(
    query_embeddings=model.encode([query]).tolist(),
    n_results=k
)
```

This gives you proper semantic search that understands meaning, not just keywords.
