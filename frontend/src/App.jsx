/**
 * App.jsx — final merged version
 * Place at: frontend/src/App.jsx
 *
 * Combines:
 *  - Old: useDocuments { docs, stats, loading, upload, addSnippet, remove, refreshAll }
 *  - Old: useChat      { messages, isStreaming, sendMessage, clear }
 *  - Old: Header, Sidebar, ChatPanel with their exact existing prop names
 *  - New: ChatHistoryPanel (new chat + recent chats history)
 *  - New: useChat gains newChat + loadSession (added in updated useChat.js)
 */

import React, { useEffect } from 'react'
import Header            from './components/Header.jsx'
import Sidebar           from './components/Sidebar.jsx'
import ChatPanel         from './components/ChatPanel.jsx'
import ChatHistoryPanel  from './components/ChatHistoryPanel.jsx'  // NEW
import { useDocuments }  from './hooks/useDocuments.js'
import { useChat }       from './hooks/useChat.js'
import styles            from './App.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function pingHealth() {
  try { await fetch(`${BASE}/api/health`) } catch { /* silent */ }
}

export default function App() {
  // ── documents (exact same destructure as your original) ──────────────────
  const { docs, stats, loading, upload, addSnippet, remove, refreshAll } = useDocuments()

  // ── chat (original fields + new newChat / loadSession / sessionId) ────────
  const {
    messages,
    isStreaming,
    sendMessage,
    clear,          // original — clears messages in-panel
    newChat,        // new — clears + rotates session id + deletes server history
    loadSession,    // new — loads a past session from history API
    sessionId,      // new — current session id (needed by ChatHistoryPanel)
  } = useChat()

  useEffect(() => {
    refreshAll()
    pingHealth()    // wakes Render free-tier backend proactively
  }, [])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      <Header stats={stats} />

      <div className={styles.body}>

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <div className={styles.leftSidebar}>

          {/* Your original knowledge-base sidebar — props unchanged */}
          <Sidebar
            docs={docs}
            loading={loading}
            onUpload={upload}
            onAddText={addSnippet}
            onRemove={remove}
          />

          {/* Thin divider */}
          <div className={styles.divider} />

          {/* NEW: chat history — New Chat button + recent sessions list */}
          <ChatHistoryPanel
            currentSessionId={sessionId}
            onNewChat={newChat}
            onLoadSession={loadSession}
          />
        </div>

        {/* ── Main chat panel — props unchanged ────────────────────────── */}
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          docs={docs}
          onSend={sendMessage}
          onClear={newChat}   // "Clear" now also starts a fresh session
        />

      </div>
    </div>
  )
}
