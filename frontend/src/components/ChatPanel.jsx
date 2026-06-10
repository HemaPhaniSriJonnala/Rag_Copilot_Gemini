import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, RotateCcw, FileSearch, Zap } from 'lucide-react'
import styles from './ChatPanel.module.css'

const SUGGESTIONS = [
  'Summarize the key points',
  'What are the main topics covered?',
  'List all important facts',
  'Explain this in simple terms',
]

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      <span /><span /><span />
      <span className={styles.typingLabel}>Retrieving & reasoning…</span>
    </div>
  )
}

function SourcesBlock({ sources }) {
  if (!sources?.length) return null
  return (
    <div className={styles.sourcesBlock}>
      <div className={styles.sourcesLabel}><FileSearch size={11} /> Retrieved Sources</div>
      {sources.map((s, i) => (
        <div key={i} className={styles.sourceRow}>
          <div>
            <span className={styles.sourceDoc}>
              📄 {s.doc_name}
              </span>
            <span className={styles.sourceChunk}>
                chunk {s.chunk_index + 1}
              </span>
            <span className={styles.sourceScore}>
              {Math.round(s.score * 100)}% match
              </span>
          </div>

  {s.preview && (
  <p className={styles.sourcePreview}>
    {s.preview}
  </p>
)}
</div>
      ))}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${styles.msg} ${isUser ? styles.user : styles.ai}`} style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAi}`}>
        {isUser ? '👤' : '🧠'}
      </div>
      <div className={styles.msgBody}>
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAi} ${msg.error ? styles.bubbleError : ''}`}>
          {msg.streaming && !msg.content ? (
            <TypingDots />
          ) : (
            <div className="md-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && <SourcesBlock sources={msg.sources} />}
        <div className={styles.msgTime}>
          {msg.ts?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.streaming && <span className={styles.streamingBadge}> · streaming</span>}
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel({ messages, isStreaming, docs, onSend, onClear }) {
  const [input, setInput] = useState('')
  const [grounded, setGrounded] = useState(true)
  const bottomRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const q = input.trim()
    if (!q || isStreaming) return
    setInput('')
    textareaRef.current.style.height = 'auto'
    onSend(q, grounded)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className={styles.panel}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarLabel}>Context:</span>
          <div className={styles.chips}>
            {docs.length === 0
              ? <span className={styles.chip}>No documents loaded</span>
              : docs.slice(0, 4).map(d => (
                  <span key={d.id} className={styles.chip}>{d.name.slice(0, 16)}</span>
                ))
            }
            {docs.length > 4 && <span className={styles.chip}>+{docs.length - 4} more</span>}
          </div>
        </div>
        <button className={styles.clearBtn} onClick={onClear} title="Clear chat">
          <RotateCcw size={12} /> Clear
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔍</div>
            <div className={styles.emptyTitle}>Chat with your documents</div>
            <p className={styles.emptyDesc}>
              Upload documents in the sidebar, then ask questions.<br />
              Answers are grounded in your knowledge base using vector search.
            </p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map(s => (
                <button key={s} className={styles.suggestion} onClick={() => onSend(s, grounded)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => <Message key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        <div className={styles.inputWrap}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Ask anything about your documents… (Shift+Enter for newline)"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send size={14} />
          </button>
        </div>

        <div className={styles.inputMeta}>
          <span className={styles.hint}>
            {grounded
              ? `RAG active · top-3 chunks · ${docs.length} doc${docs.length !== 1 ? 's' : ''} indexed`
              : 'Direct LLM mode · no retrieval'}
          </span>
          <label className={styles.toggle}>
            <span>Grounded</span>
            <span
              className={`${styles.toggleSwitch} ${grounded ? styles.on : styles.off}`}
              onClick={() => setGrounded(g => !g)}
              role="switch"
              aria-checked={grounded}
              tabIndex={0}
              onKeyDown={e => e.key === ' ' && setGrounded(g => !g)}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
