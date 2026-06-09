import React, { useEffect } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import { useDocuments } from './hooks/useDocuments.js'
import { useChat } from './hooks/useChat.js'
import styles from './App.module.css'

export default function App() {
  const { docs, stats, loading, upload, addSnippet, remove, refreshAll } = useDocuments()
  const { messages, isStreaming, sendMessage, clear } = useChat()

  useEffect(() => { refreshAll() }, [])

  return (
    <div className={styles.app}>
      <Header stats={stats} />
      <div className={styles.body}>
        <Sidebar
          docs={docs}
          loading={loading}
          onUpload={upload}
          onAddText={addSnippet}
          onRemove={remove}
        />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          docs={docs}
          onSend={sendMessage}
          onClear={clear}
        />
      </div>
    </div>
  )
}
