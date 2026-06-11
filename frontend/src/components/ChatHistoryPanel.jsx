/**
 * ChatHistoryPanel.jsx  ─  frontend/src/components/ChatHistoryPanel.jsx
 *
 * FIX: New Chat button now awaits onNewChat() before reloading sessions,
 *      so the new (empty) session is reflected in the list correctly.
 *      Also: reloads session list after returning from newChat.
 */

import { useState, useEffect, useCallback } from 'react'
import styles from './ChatHistoryPanel.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

function timeAgo(ts) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ChatHistoryPanel({ currentSessionId, onNewChat, onLoadSession }) {
  const [sessions, setSessions]     = useState([])
  const [previews, setPreviews]     = useState({})
  const [loading, setLoading]       = useState(false)
  const [activeId, setActiveId]     = useState(currentSessionId)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { setActiveId(currentSessionId) }, [currentSessionId])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/history`)
      if (!res.ok) return
      const data = await res.json()
      setSessions(data)

      const map = {}
      await Promise.all(data.map(async s => {
        try {
          const r = await fetch(`${BASE}/api/history/${s.session_id}`)
          if (!r.ok) return
          const msgs = await r.json()
          const first = msgs.find(m => m.role === 'user')
          map[s.session_id] = first?.content ?? '…'
        } catch { map[s.session_id] = '…' }
      }))
      setPreviews(map)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleSelect = async (sessionId) => {
    setActiveId(sessionId)
    try {
      const res = await fetch(`${BASE}/api/history/${sessionId}`)
      if (!res.ok) return
      const msgs = await res.json()
      onLoadSession(sessionId, msgs)
    } catch (err) {
      console.error('Failed to load session:', err)
    }
  }

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation()
    setDeletingId(sessionId)
    try {
      await fetch(`${BASE}/api/history/${sessionId}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
      if (activeId === sessionId) {
        await onNewChat()
        setActiveId(null)
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    } finally {
      setDeletingId(null)
    }
  }

  // ✅ FIX: await onNewChat(), then reload sessions list
  const handleNewChat = async () => {
    await onNewChat()
    setActiveId(null)
    // slight delay so backend has time to process the delete
    setTimeout(loadSessions, 200)
  }

  return (
    <div className={styles.panel}>
      <button className={styles.newChatBtn} onClick={handleNewChat}>
        <span className={styles.plusIcon}>＋</span>
        New Chat
      </button>

      <div className={styles.sectionLabel}>Recent Chats</div>

      {loading && <p className={styles.hint}>Loading…</p>}
      {!loading && sessions.length === 0 && (
        <p className={styles.hint}>No previous chats yet.</p>
      )}

      <ul className={styles.list}>
        {sessions.map(s => (
          <li
            key={s.session_id}
            className={`${styles.item} ${activeId === s.session_id ? styles.active : ''}`}
            onClick={() => handleSelect(s.session_id)}
          >
            <div className={styles.preview}>
              {(previews[s.session_id] ?? '…').slice(0, 52)}
              {(previews[s.session_id] ?? '').length > 52 ? '…' : ''}
            </div>
            <div className={styles.meta}>
              <span className={styles.time}>{timeAgo(s.last_active)}</span>
              <span className={styles.msgCount}>{s.message_count} msgs</span>
              <button
                className={styles.deleteBtn}
                onClick={e => handleDelete(e, s.session_id)}
                disabled={deletingId === s.session_id}
                title="Delete this chat"
              >
                {deletingId === s.session_id ? '…' : '×'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
