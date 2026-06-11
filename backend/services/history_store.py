"""
HistoryStore — persists chat messages to a local SQLite database.
No extra install needed: sqlite3 is part of Python's stdlib.

Schema
------
sessions(session_id TEXT, role TEXT, content TEXT, ts REAL)
"""

import sqlite3
import time
import os
from pathlib import Path

DB_PATH = os.getenv("HISTORY_DB_PATH", "chat_history.db")


class HistoryStore:
    def __init__(self):
        self._db = DB_PATH
        self._init_db()

    # ── internal ─────────────────────────────────────────────────────────────

    def _conn(self):
        conn = sqlite3.connect(self._db)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT    NOT NULL,
                    role       TEXT    NOT NULL,
                    content    TEXT    NOT NULL,
                    ts         REAL    NOT NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id)"
            )
            conn.commit()

    # ── public API ────────────────────────────────────────────────────────────

    def append(self, session_id: str, role: str, content: str) -> None:
        """Add one message to the session."""
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO messages (session_id, role, content, ts) VALUES (?,?,?,?)",
                (session_id, role, content, time.time()),
            )
            conn.commit()

    def get(self, session_id: str, limit: int = 50) -> list[dict]:
        """Return the most recent `limit` messages for a session."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT role, content, ts
                FROM messages
                WHERE session_id = ?
                ORDER BY ts DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        # Return in chronological order
        return [dict(r) for r in reversed(rows)]

    def clear(self, session_id: str) -> None:
        """Delete all messages for a session."""
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM messages WHERE session_id = ?", (session_id,)
            )
            conn.commit()

    def list_sessions(self) -> list[dict]:
        """Return all unique session_ids with message count and last activity."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT session_id,
                       COUNT(*)  AS message_count,
                       MAX(ts)   AS last_active
                FROM messages
                GROUP BY session_id
                ORDER BY last_active DESC
                """
            ).fetchall()
        return [dict(r) for r in rows]
