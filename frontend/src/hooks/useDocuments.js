import { useState, useCallback } from 'react'
import { fetchDocs, uploadFile, addText, deleteDoc, fetchStats } from '../utils/api'

export function useDocuments() {
  const [docs, setDocs] = useState([])
  const [stats, setStats] = useState({ doc_count: 0, chunk_count: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refreshAll = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([fetchDocs(), fetchStats()])
      setDocs(d)
      setStats(s)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const upload = useCallback(async (file) => {
    setLoading(true)
    setError(null)
    try {
      await uploadFile(file)
      await refreshAll()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
      setDocs(prev => prev.filter(d => d.id !== id))
      await fetchStats().then(setStats)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  return { docs, stats, loading, error, refreshAll, upload, addSnippet, remove }
}
