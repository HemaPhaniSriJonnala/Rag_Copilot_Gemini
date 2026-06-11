/**
 * useDocuments.js  ─  frontend/src/hooks/useDocuments.js
 *
 * FIX: upload() now accepts FileList or array, uploads all files
 *      sequentially, then calls refreshAll() once at the end.
 *      This prevents the race condition where each file's refreshAll
 *      overwrote the others.
 */

import { useState, useCallback, useEffect } from 'react'
import { fetchDocs, uploadFile, addText, deleteDoc, fetchStats } from '../utils/api'

export function useDocuments() {
  const [docs, setDocs]       = useState([])
  const [stats, setStats]     = useState({ doc_count: 0, chunk_count: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const refreshAll = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([fetchDocs(), fetchStats()])
      setDocs(d)
      setStats(s)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  // ✅ FIX: accepts FileList or array, uploads all then refreshes once
  const upload = useCallback(async (filesOrList) => {
    const files = filesOrList instanceof FileList
      ? Array.from(filesOrList)
      : Array.isArray(filesOrList)
        ? filesOrList
        : [filesOrList]

    if (files.length === 0) return

    setLoading(true)
    setError(null)

    for (const file of files) {
      try {
        await uploadFile(file)    // sequential — avoids Chroma race condition
      } catch (e) {
        setError(e.message)
      }
    }

    await refreshAll()            // single refresh after ALL uploads done
    setLoading(false)
  }, [refreshAll])

  const addSnippet = useCallback(async (content, name) => {
    setLoading(true)
    setError(null)
    try {
      await addText(content, name)
      await refreshAll()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [refreshAll])

  const remove = useCallback(async (id) => {
    try {
      await deleteDoc(id)
      await refreshAll()
    } catch (e) {
      setError(e.message)
    }
  }, [refreshAll])

  return { docs, stats, loading, error, refreshAll, upload, addSnippet, remove }
}
