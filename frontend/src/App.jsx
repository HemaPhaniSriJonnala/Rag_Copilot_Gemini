/**
 * App.jsx — Redesigned RAG Copilot
 * Premium ChatGPT/Claude-inspired layout
 */

import React, { useEffect } from 'react'
import Header            from './components/Header.jsx'
import Sidebar           from './components/Sidebar.jsx'
import ChatPanel         from './components/ChatPanel.jsx'
import ChatHistoryPanel  from './components/ChatHistoryPanel.jsx'
import { useDocuments }  from './hooks/useDocuments.js'
import { useChat }       from './hooks/useChat.js'
import styles            from './App.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function pingHealth() {
  try { await fetch(`${BASE}/api/health`) } catch { /* silent */ }
}

export default function App() {
  const { docs, stats, loading, upload, addSnippet, remove, refreshAll } = useDocuments()

  const {
    messages,
    isStreaming,
    sendMessage,
    clear,
    newChat,
    loadSession,
    sessionId,
  } = useChat()

  useEffect(() => {
    refreshAll()
    pingHealth()
  }, [])

  return (
    <div className={styles.app}>
      <div className={styles.body}>
        {/* Left sidebar: history + new chat */}
        <div className={styles.leftSidebar}>
          <Sidebar />
          <ChatHistoryPanel
            currentSessionId={sessionId}
            onNewChat={newChat}
            onLoadSession={loadSession}
          />
        </div>

        {/* Main chat panel */}
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          docs={docs}
          loading={loading}
          onSend={sendMessage}
          onClear={newChat}
          onUpload={upload}
          onRemove={remove}
          stats={stats}
        />
      </div>
    </div>
  )
}
