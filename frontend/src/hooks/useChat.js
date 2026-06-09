import { useState, useCallback, useRef } from 'react'
import { streamChat } from '../utils/api'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef(false)

  const sendMessage = useCallback(async (query, grounded) => {
    if (isStreaming) return
    abortRef.current = false

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: query, ts: new Date() }
    setMessages(prev => [...prev, userMsg])

    // Placeholder for AI response
    const aiId = Date.now() + 1
    const aiMsg = { id: aiId, role: 'assistant', content: '', sources: [], ts: new Date(), streaming: true }
    setMessages(prev => [...prev, aiMsg])
    setIsStreaming(true)

    // Build history (exclude the new user msg, it's in query param)
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

    await streamChat({
      query,
      history,
      grounded,
      onSource: (sources) => {
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, sources } : m
        ))
      },
      onToken: (text) => {
        if (abortRef.current) return
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, content: m.content + text } : m
        ))
      },
      onDone: () => {
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, streaming: false } : m
        ))
        setIsStreaming(false)
      },
      onError: (msg) => {
        setMessages(prev => prev.map(m =>
          m.id === aiId
            ? { ...m, content: `⚠️ Error: ${msg}`, streaming: false, error: true }
            : m
        ))
        setIsStreaming(false)
      },
    })
  }, [messages, isStreaming])

  const clear = useCallback(() => {
    abortRef.current = true
    setMessages([])
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, sendMessage, clear }
}
