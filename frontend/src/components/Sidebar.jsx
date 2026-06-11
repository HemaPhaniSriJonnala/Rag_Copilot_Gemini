/**
 * Sidebar.jsx — Left sidebar: logo + branding only
 * Documents are now pinned in the chat header area
 */
import React from 'react'
import { Sparkles } from 'lucide-react'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Sparkles size={16} />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>RAG</span>
          <span className={styles.logoCopilot}>Copilot</span>
        </div>
      </div>
    </div>
  )
}
