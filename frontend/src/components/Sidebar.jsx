import React, { useRef, useState } from 'react'
import { Upload, FileText, Trash2, Plus, Circle } from 'lucide-react'
import styles from './Sidebar.module.css'

const FILE_ICONS = {
  md: '📝',
  json: '🗂️',
  csv: '📊',
  html: '🌐',
  txt: '📄',
  pdf: '📕',
  docx: '📘',
}
function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  return FILE_ICONS[ext] || '📄'
}
function timeAgo(iso) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  return `${Math.floor(diff/3600)}h ago`
}

export default function Sidebar({ docs, loading, onUpload, onAddText, onRemove }) {
  const fileRef = useRef()
  const [snippet, setSnippet] = useState('')
  const [drag, setDrag] = useState(false)
  const [snippetOpen, setSnippetOpen] = useState(false)

  const handleFiles = (files) => {
    Array.from(files).forEach(f => onUpload(f))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleAddSnippet = () => {
    const val = snippet.trim()
    if (!val) return
    const name = 'snippet-' + Date.now().toString(36).slice(-4) + '.txt'
    onAddText(val, name)
    setSnippet('')
    setSnippetOpen(false)
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Knowledge Base</div>

        {/* Upload zone */}
        <div
          className={`${styles.uploadZone} ${drag ? styles.dragOver : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.html,.pdf,.docx"
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
          <Upload size={20} className={styles.uploadIcon} />
          <div className={styles.uploadTitle}>Drop files or click to browse</div>
          <div className={styles.uploadSub}>.txt · .md · .csv · .json · .html · .pdf · .docx</div>
        </div>

        {/* Snippet toggle */}
        <button
          className={styles.snippetToggle}
          onClick={() => setSnippetOpen(o => !o)}
        >
          <Plus size={12} />
          {snippetOpen ? 'Cancel' : 'Paste text snippet'}
        </button>

        {snippetOpen && (
          <div className={styles.snippetArea}>
            <textarea
              className={styles.snippetInput}
              placeholder="Paste any text content here…"
              rows={4}
              value={snippet}
              onChange={e => setSnippet(e.target.value)}
            />
            <button className={styles.btnViolet} onClick={handleAddSnippet} disabled={!snippet.trim()}>
              Add to Knowledge Base
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Docs list */}
      <div className={styles.section} style={{ paddingBottom: 4 }}>
        <div className={styles.sectionLabel}>
          Indexed Documents
          {loading && <span className={styles.loadingDot} />}
        </div>
      </div>

      <div className={styles.docsList}>
        {docs.length === 0 ? (
          <div className={styles.emptyDocs}>
            <FileText size={24} style={{ opacity: 0.3 }} />
            <span>No documents yet</span>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className={styles.docItem}>
              <span className={styles.docIcon}>{fileIcon(doc.name)}</span>
              <div className={styles.docInfo}>
                <div className={styles.docName} title={doc.name}>{doc.name}</div>
                <div className={styles.docMeta}>
                  {doc.chunk_count} chunks · {timeAgo(doc.created_at)}
                </div>
              </div>
              <span className={styles.docReady} title="Indexed" />
              <button
                className={styles.docDel}
                onClick={() => onRemove(doc.id)}
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span>Model</span>
          <span className={styles.mono}>gemini-2.5-flash</span>
        </div>
        <div className={styles.footerRow}>
          <span>Retrieval</span>
          <span className={styles.mono}>TF-IDF · cosine</span>
        </div>
      </div>
    </aside>
  )
}
