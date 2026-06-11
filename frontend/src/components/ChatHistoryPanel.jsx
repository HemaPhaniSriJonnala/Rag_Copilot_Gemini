/**
 * ChatHistoryPanel.jsx
 * Place at: frontend/src/components/ChatHistoryPanel.jsx
 *
 * Shows:
 *  - "New Chat" button at the top
 *  - List of recent sessions with timestamp + first message preview
 *  - Click any session to load it back into the chat
 */

import { useState, useEffect, useCallback } from "react";
import styles from "./ChatHistoryPanel.module.css";

const BASE = import.meta.env.VITE_API_URL ?? "";

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60)        return "just now";
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ChatHistoryPanel({ currentSessionId, onNewChat, onLoadSession }) {
  const [sessions, setSessions]     = useState([]);
  const [previews, setPreviews]     = useState({});   // sessionId → first user message
  const [loading, setLoading]       = useState(false);
  const [activeId, setActiveId]     = useState(currentSessionId);
  const [deletingId, setDeletingId] = useState(null);

  // load session list
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/history");           // list_sessions()
      setSessions(data);

      // fetch first message of each session for preview
      const previewMap = {};
      await Promise.all(
        data.map(async (s) => {
          try {
            const msgs = await apiGet(`/api/history/${s.session_id}?limit=1`);
            const first = msgs.find((m) => m.role === "user");
            previewMap[s.session_id] = first?.content ?? "…";
          } catch {
            previewMap[s.session_id] = "…";
          }
        })
      );
      setPreviews(previewMap);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // sync active marker when parent changes session
  useEffect(() => {
    setActiveId(currentSessionId);
  }, [currentSessionId]);

  // click a session → load its messages
  const handleSelect = async (sessionId) => {
    setActiveId(sessionId);
    try {
      const msgs = await apiGet(`/api/history/${sessionId}`);
      onLoadSession(sessionId, msgs);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  // delete one session
  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await apiDelete(`/api/history/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeId === sessionId) onNewChat();
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.panel}>

      {/* New Chat button */}
      <button
        className={styles.newChatBtn}
        onClick={() => { onNewChat(); setActiveId(null); loadSessions(); }}
      >
        <span className={styles.plusIcon}>＋</span>
        New Chat
      </button>

      <div className={styles.sectionLabel}>Recent Chats</div>

      {loading && <p className={styles.hint}>Loading…</p>}

      {!loading && sessions.length === 0 && (
        <p className={styles.hint}>No previous chats yet.</p>
      )}

      <ul className={styles.list}>
        {sessions.map((s) => (
          <li
            key={s.session_id}
            className={`${styles.item} ${activeId === s.session_id ? styles.active : ""}`}
            onClick={() => handleSelect(s.session_id)}
          >
            {/* preview text */}
            <div className={styles.preview}>
              {(previews[s.session_id] ?? "…").slice(0, 52)}
              {(previews[s.session_id] ?? "").length > 52 ? "…" : ""}
            </div>

            {/* meta row */}
            <div className={styles.meta}>
              <span className={styles.time}>{timeAgo(s.last_active)}</span>
              <span className={styles.msgCount}>{s.message_count} msgs</span>

              {/* delete button */}
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(e, s.session_id)}
                title="Delete this chat"
                aria-label="Delete chat"
                disabled={deletingId === s.session_id}
              >
                {deletingId === s.session_id ? "…" : "×"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
