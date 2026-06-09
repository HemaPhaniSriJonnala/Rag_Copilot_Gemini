const BASE = '/api'

export async function fetchDocs() {
  const r = await fetch(`${BASE}/docs`)
  if (!r.ok) throw new Error('Failed to fetch docs')
  return r.json()
}

export async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${BASE}/docs/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('Upload failed')
  return r.json()
}

export async function addText(content, name) {
  const r = await fetch(`${BASE}/docs/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, name }),
  })
  if (!r.ok) throw new Error('Failed to add text')
  return r.json()
}

export async function deleteDoc(id) {
  const r = await fetch(`${BASE}/docs/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('Failed to delete doc')
  return r.json()
}

export async function fetchStats() {
  const r = await fetch(`${BASE}/stats`)
  if (!r.ok) throw new Error('Failed to fetch stats')
  return r.json()
}

/**
 * Chat with SSE streaming.
 * Calls onSource(sources[]) once, then onToken(text) for each chunk, then onDone().
 */
export async function streamChat({ query, history, grounded, onSource, onToken, onDone, onError }) {
  try {
    const r = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, history, grounded }),
    })
    if (!r.ok) throw new Error(`Server error ${r.status}`)

    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      const lines = buf.split('\n')
      buf = lines.pop() // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw)
          if (event.type === 'sources') onSource(event.sources)
          else if (event.type === 'token') onToken(event.text)
          else if (event.type === 'done') onDone()
        } catch {}
      }
    }
    onDone()
  } catch (err) {
    onError(err.message)
  }
}
