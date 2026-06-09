#!/bin/bash
# start.sh — launch backend (Gemini) + frontend together

set -e
echo "🧠 Starting RAG Copilot (Gemini free tier)..."

cd backend

if [ ! -d ".venv" ]; then
  echo "→ Creating Python venv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
  echo "⚠️  No .env found. Creating from example..."
  cp .env.example .env
  echo ""
  echo "   ➜  Edit backend/.env and set GEMINI_API_KEY=AIza..."
  echo "   ➜  Get a free key at: https://aistudio.google.com/apikey"
  echo ""
  exit 1
fi

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "✅ Backend → http://localhost:8000  (PID $BACKEND_PID)"

cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "→ Installing npm packages..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend → http://localhost:5173  (PID $FRONTEND_PID)"
echo ""
echo "🚀 Open http://localhost:5173 in your browser"
echo "   Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
