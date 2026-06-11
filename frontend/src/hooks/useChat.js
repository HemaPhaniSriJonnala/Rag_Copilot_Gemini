/**
 * useChat.js — final merged version
 * Place at: frontend/src/hooks/useChat.js
 *
 * Keeps your original return shape:
 *   { messages, isStreaming, sendMessage, clear }
 *
 * Adds new fields (used only by App.jsx + ChatHistoryPanel):
 *   { newChat, loadSession, sessionId }
 */

import { useState, useCallback, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''

function makeSessionId() {
  return crypto.randomUUID()
}

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('rag_session_id')
  if (!id) {
    id = makeSessionId()
    sessionStorage.setItem('rag_session_id', id)
  }
  return id
}

export function useChat() {
  const [messages, setMessages]       = useState([])
  const [isStreaming, setIsStreaming]  = useState(false)   // your original field name
  const [error, setError]             = useState(null)
  const [sessionId, setSessionId]     = useState(getOrCreateSessionId)

  const abortRef = useRef(null)

  // ── sendMessage — keeps your original signature: sendMessage(query, grounded?) ──
  const sendMessage = useCallback(async (query, grounded = true) => {
    if (!query.trim() || isStreaming) return

    const userMsg      = { role: 'user',      content: query,  sources: [] }
    const assistantMsg = { role: 'assistant', content: '',     sources: [] }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          grounded,
          session_id: sessionId,
          history: messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   fullReply = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'sources') {
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { ...copy[copy.length - 1], sources: event.sources ?? [] }
                return copy
              })
            }

            if (event.type === 'token') {
              fullReply += event.token
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullReply }
                return copy
              })
            }

            if (event.type === 'done') {
              setIsStreaming(false)
            }

          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong')
        setIsStreaming(false)
      }
    }
  }, [isStreaming, messages, sessionId])

  // ── clear — your original: just wipes the in-panel message list ──────────
  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // ── newChat — new: clear + rotate session id + delete server history ──────
  const newChat = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/history/${sessionId}`, { method: 'DELETE' })
    } catch { /* best-effort */ }

    const newId = makeSessionId()
    sessionStorage.setItem('rag_session_id', newId)
    setSessionId(newId)
    setMessages([])
    setError(null)
  }, [sessionId])

  // ── loadSession — new: restore a past session from history API ────────────
  const loadSession = useCallback((loadedSessionId, historyMessages) => {
    const converted = historyMessages.map((m) => ({
      role:    m.role,
      content: m.content,
      sources: [],
    }))
    setMessages(converted)
    setError(null)
    setSessionId(loadedSessionId)
    sessionStorage.setItem('rag_session_id', loadedSessionId)
  }, [])

  // ── stopGeneration ────────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return {
    // ── original fields (unchanged) ──
    messages,
    isStreaming,
    sendMessage,
    clear,
    error,
    // ── new fields ──────────────────
    sessionId,
    newChat,
    loadSession,
    stopGeneration,
  }
}