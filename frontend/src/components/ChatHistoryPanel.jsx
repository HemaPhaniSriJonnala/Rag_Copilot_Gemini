/**
 * ChatHistoryPanel.jsx — Left sidebar chat history
 * New Chat button + recent sessions list
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, MessageSquare, Trash2, Clock } from 'lucide-react'
import styles from './ChatHistoryPanel.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

function timeAgo(ts) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getTitle(preview) {
  if (!preview || preview === '…') return 'New conversation'
  const t = preview.slice(0, 40)
  return t.length < preview.length ? t + '…' : t
}

export default function ChatHistoryPanel({ currentSessionId, onNewChat, onLoadSession }) {
  const [sessions, setSessions]     = useState([])
  const [previews, setPreviews]     = useState({})
  const [loading, setLoading]       = useState(false)
  const [activeId, setActiveId]     = useState(currentSessionId)
  const [deletingId, setDeletingId] = useState(null)
  const [hoverId, setHoverId]       = useState(null)

  useEffect(() => { setActiveId(currentSessionId) }, [currentSessionId])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/history`)
      if (!res.ok) return
      const data = await res.json()
      setSessions(data)

      // Only fetch previews for sessions we don't already have
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
      // Merge: keep old previews, overwrite with fresh ones
      setPreviews(prev => ({ ...prev, ...map }))
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

  const handleDelete = async (e, sid) => {
    e.stopPropagation()
    setDeletingId(sid)
    try {
      await fetch(`${BASE}/api/history/${sid}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.session_id !== sid))
      setPreviews(prev => { const n = { ...prev }; delete n[sid]; return n })
      if (activeId === sid) {
        setActiveId(null)
        await onNewChat()
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleNewChat = async () => {
    await onNewChat()   // rotates session id locally, does NOT delete from server
    setActiveId(null)
    setTimeout(() => loadSessions(), 400)   // reload after backend persists last msgs
  }

  return (
    <div className={styles.panel}>
      <button className={styles.newChatBtn} onClick={handleNewChat}>
        <Plus size={16} strokeWidth={2.5} />
        <span>New Chat</span>
      </button>

      <div className={styles.sectionLabel}>
        <Clock size={11} />
        Recent
      </div>

      {loading && (
        <div className={styles.loadingRows}>
          {[1,2,3].map(i => <div key={i} className={styles.loadingRow} />)}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className={styles.emptyHint}>
          <MessageSquare size={20} opacity={0.3} />
          <span>No chats yet</span>
        </div>
      )}

      <ul className={styles.list}>
        {sessions.map(s => (
          <li
            key={s.session_id}
            className={`${styles.item} ${activeId === s.session_id ? styles.active : ''}`}
            onClick={() => handleSelect(s.session_id)}
            onMouseEnter={() => setHoverId(s.session_id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <div className={styles.itemIcon}>
              <MessageSquare size={13} />
            </div>
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>
                {getTitle(previews[s.session_id])}
              </div>
              <div className={styles.itemMeta}>
                <span>{timeAgo(s.last_active)}</span>
                <span className={styles.dot}>·</span>
                <span>{s.message_count} msgs</span>
              </div>
            </div>
            {(hoverId === s.session_id || activeId === s.session_id) && (
              <button
                className={styles.deleteBtn}
                onClick={e => handleDelete(e, s.session_id)}
                disabled={deletingId === s.session_id}
                title="Delete chat"
              >
                <Trash2 size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
