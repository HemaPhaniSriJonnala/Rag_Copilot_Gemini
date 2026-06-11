/**
 * useChat.js  ─  frontend/src/hooks/useChat.js
 *
 * FIX: event.token → event.text  (llm.py sends { type:'token', text: '...' })
 *      newChat properly awaits delete before clearing
 */

import { useState, useCallback, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? ''

function makeSessionId() { return crypto.randomUUID() }

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('rag_session_id')
  if (!id) { id = makeSessionId(); sessionStorage.setItem('rag_session_id', id) }
  return id
}

export function useChat() {
  const [messages, setMessages]      = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError]            = useState(null)
  const [sessionId, setSessionId]    = useState(getOrCreateSessionId)
  const abortRef = useRef(null)

  const sendMessage = useCallback(async (query, grounded = true) => {
    if (!query.trim() || isStreaming) return

    const userMsg      = { id: Date.now(),     role: 'user',      content: query, sources: [], ts: new Date() }
    const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: '',    sources: [], ts: new Date(), streaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          grounded,
          session_id: sessionId,
          history: messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)

            if (event.type === 'sources') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { ...copy[copy.length - 1], sources: event.sources ?? [] }
                return copy
              })
            }

            // ✅ FIX: llm.py sends event.text, NOT event.token
            if (event.type === 'token') {
              const chunk = event.text ?? event.token ?? ''
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                copy[copy.length - 1] = { ...last, content: last.content + chunk }
                return copy
              })
            }

            if (event.type === 'done') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false }
                return copy
              })
              setIsStreaming(false)
            }

          } catch { /* ignore malformed SSE */ }
        }
      }
      setIsStreaming(false)

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong')
        setIsStreaming(false)
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], error: true, streaming: false, content: '⚠ ' + (err.message || 'Error') }
          return copy
        })
      }
    }
  }, [isStreaming, messages, sessionId])

  const clear = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // FIX: do NOT delete the old session — we want it to appear in history.
  // Just rotate to a fresh session id and clear the local message list.
  const newChat = useCallback(async () => {
    const newId = makeSessionId()
    sessionStorage.setItem('rag_session_id', newId)
    setSessionId(newId)
    setMessages([])
    setError(null)
    return newId
  }, [])

  const loadSession = useCallback((loadedSessionId, historyMessages) => {
    const converted = historyMessages.map(m => ({
      id: Math.random(),
      role: m.role,
      content: m.content,
      sources: [],
      ts: new Date(m.ts * 1000),
      streaming: false,
    }))
    setMessages(converted)
    setError(null)
    setSessionId(loadedSessionId)
    sessionStorage.setItem('rag_session_id', loadedSessionId)
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return {
    messages, isStreaming, error, sessionId,
    sendMessage, clear, newChat, loadSession, stopGeneration,
  }
}
