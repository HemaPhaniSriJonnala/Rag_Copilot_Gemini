import React from 'react'
import { Brain, Zap } from 'lucide-react'
import styles from './Header.module.css'

export default function Header({ stats }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Brain size={16} />
        </div>
        <span className={styles.logoText}>RAG <span>Copilot</span></span>
        <span className={styles.badge}>
          <Zap size={10} /> High Impact
        </span>
      </div>

      <div className={styles.right}>
        <div className={styles.pills}>
          <span className={styles.pill}>
            Docs: <strong>{stats.doc_count}</strong>
          </span>
          <span className={styles.pill}>
            Chunks: <strong>{stats.chunk_count}</strong>
          </span>
        </div>
        <span className={styles.status}>● Ready</span>
      </div>
    </header>
  )
}
