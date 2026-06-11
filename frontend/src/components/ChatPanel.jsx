/**
 * ChatPanel.jsx — Premium redesigned chat area
 * Features:
 *  - Chat header with title + pinned document pills
 *  - Upload via + button next to input (no sidebar upload box)
 *  - Voice input via microphone button
 *  - Drag-and-drop file upload on chat area
 *  - Grounded toggle, send button
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, RotateCcw, FileSearch, Plus, X, File, Mic,
  MicOff, FileText, FileSpreadsheet, Code2, Globe, Zap,
  ChevronDown, Paperclip
} from 'lucide-react'
import styles from './ChatPanel.module.css'

const SUGGESTIONS = [
  'Summarize the key points from these documents',
  'What are the main topics covered?',
  'List all important facts and figures',
  'Explain the key findings in simple terms',
]

function getFileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return <FileText size={12} />
  if (['csv', 'xlsx'].includes(ext)) return <FileSpreadsheet size={12} />
  if (['js', 'ts', 'py', 'json'].includes(ext)) return <Code2 size={12} />
  if (ext === 'html') return <Globe size={12} />
  return <File size={12} />
}

function getFileColor(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return '#EF4444'
  if (ext === 'docx') return '#3B82F6'
  if (['csv', 'xlsx'].includes(ext)) return '#10B981'
  if (ext === 'html') return '#F59E0B'
  return '#A78BFA'
}

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      <span /><span /><span />
      <span className={styles.typingLabel}>Thinking…</span>
    </div>
  )
}

function SourcesBlock({ sources }) {
  const [open, setOpen] = useState(false)
  if (!sources?.length) return null
  return (
    <div className={styles.sourcesBlock}>
      <button className={styles.sourcesToggle} onClick={() => setOpen(o => !o)}>
        <FileSearch size={11} />
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''} retrieved</span>
        <ChevronDown size={11} className={open ? styles.chevronOpen : ''} />
      </button>
      {open && (
        <div className={styles.sourcesList}>
          {sources.map((s, i) => (
            <div key={i} className={styles.sourceRow}>
              <div className={styles.sourceHeader}>
                <span className={styles.sourceDoc}>📄 {s.doc_name}</span>
                <span className={styles.sourceChunk}>chunk {s.chunk_index + 1}</span>
                <span className={styles.sourceScore}>{Math.round(s.score * 100)}%</span>
              </div>
              {s.preview && <p className={styles.sourcePreview}>{s.preview}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${styles.msg} ${isUser ? styles.user : styles.ai}`}>
      <div className={`${styles.avatar} ${isUser ? styles.avatarUser : styles.avatarAi}`}>
        {isUser ? (
          <span className={styles.avatarInitial}>U</span>
        ) : (
          <Zap size={13} />
        )}
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

/* Voice waveform animation */
function VoiceWave() {
  return (
    <div className={styles.voiceWave}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className={styles.voiceBar} style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

export default function ChatPanel({ messages, isStreaming, docs, loading, onSend, onClear, onUpload, onRemove, stats }) {
  const [input, setInput]             = useState('')
  const [grounded, setGrounded]       = useState(true)
  const [drag, setDrag]               = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported]              = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const [voiceTranscript, setVoiceTranscript] = useState('')

  const bottomRef   = useRef()
  const textareaRef = useRef()
  const fileRef     = useRef()
  const recognitionRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    const q = input.trim()
    if (!q || isStreaming) return
    setInput('')
    setVoiceTranscript('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    onSend(q, grounded)
  }, [input, isStreaming, grounded, onSend])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const handleFiles = (files) => {
    if (!files || files.length === 0) return
    onUpload(files)
  }

  /* Drag-and-drop onto chat area */
  const handleDragOver = (e) => { e.preventDefault(); setDrag(true) }
  const handleDragLeave = () => setDrag(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    handleFiles(e.dataTransfer.files)
  }

  /* Voice recognition */
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setVoiceTranscript(transcript)
      setInput(transcript)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px'
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  const toggleVoice = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  /* Active chat title */
  const chatTitle = messages.length > 0
    ? (messages.find(m => m.role === 'user')?.content ?? 'New Chat').slice(0, 48)
    : 'New Chat'

  return (
    <div
      className={`${styles.panel} ${drag ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Chat Header ─────────────────────────────────────────────── */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatTitle}>
            {messages.length === 0 ? 'New Chat' : chatTitle}
            {messages.length > 0 && chatTitle.length >= 48 && '…'}
          </div>
          {docs.length > 0 && (
            <div className={styles.docsBadge}>
              <Paperclip size={11} />
              {docs.length} doc{docs.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Pinned documents — top right */}
        <div className={styles.pinnedDocs}>
          {loading && (
            <div className={styles.uploadingPill}>
              <span className={styles.uploadSpinner} />
              Uploading…
            </div>
          )}
          {docs.map(doc => (
            <div key={doc.id} className={styles.docPill} style={{ '--doc-color': getFileColor(doc.name) }}>
              <span className={styles.docPillIcon}>{getFileIcon(doc.name)}</span>
              <span className={styles.docPillName} title={doc.name}>
                {doc.name.length > 18 ? doc.name.slice(0, 18) + '…' : doc.name}
              </span>
              <button
                className={styles.docPillRemove}
                onClick={() => onRemove(doc.id)}
                title="Remove document"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          <button
            className={styles.clearBtn}
            onClick={onClear}
            title="New chat"
          >
            <RotateCcw size={13} />
          </button>

          <div className={styles.statPills}>
            <span className={styles.statPill}>
              {stats.doc_count} docs · {stats.chunk_count} chunks
            </span>
          </div>
        </div>
      </div>

      {/* ── Drag overlay ───────────────────────────────────────────── */}
      {drag && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayInner}>
            <Plus size={32} />
            <span>Drop files to add to knowledge base</span>
          </div>
        </div>
      )}

      {/* ── Messages ──────────────────────────────────────────────── */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyGradientOrb} />
            <div className={styles.emptyIcon}>
              <Zap size={32} />
            </div>
            <div className={styles.emptyTitle}>
              {docs.length === 0
                ? 'Upload documents to get started'
                : `Ask anything about your ${docs.length} document${docs.length !== 1 ? 's' : ''}`
              }
            </div>
            <p className={styles.emptyDesc}>
              {docs.length === 0
                ? 'Click the + button or drag files into this window. Then ask questions and get AI-powered answers grounded in your documents.'
                : 'Answers are grounded in your uploaded documents using semantic vector search.'
              }
            </p>
            {docs.length > 0 && (
              <div className={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.suggestion} onClick={() => onSend(s, grounded)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map(m => <Message key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Voice status banner ────────────────────────────────────── */}
      {isListening && (
        <div className={styles.voiceBanner}>
          <VoiceWave />
          <span>Listening… speak your question</span>
          <button className={styles.voiceStopBtn} onClick={stopListening}>
            <X size={12} /> Stop
          </button>
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────────────── */}
      <div className={styles.inputBar}>
        <div className={`${styles.inputBox} ${isListening ? styles.inputBoxListening : ''}`}>
          {/* Upload button */}
          <button
            className={styles.attachBtn}
            onClick={() => fileRef.current?.click()}
            title="Attach files"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.html,.pdf,.docx"
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={isListening ? 'Listening…' : 'Ask anything about your documents…'}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isListening}
          />

          {/* Voice button */}
          {voiceSupported && (
            <button
              className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnActive : ''}`}
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          {/* Send button */}
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title="Send"
          >
            <Send size={14} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.inputMeta}>
          <span className={styles.hint}>
            {isListening
              ? '🎙 Voice input active — speak clearly'
              : grounded
                ? `RAG active · ${docs.length} doc${docs.length !== 1 ? 's' : ''} · Shift+Enter for newline`
                : 'Direct LLM · no retrieval · Shift+Enter for newline'
            }
          </span>
          <label className={styles.toggle}>
            <span className={styles.toggleLabel}>Grounded</span>
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
