'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

const ResultsContext = createContext()

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Local media cache ────────────────────────────────────────────────────────
// file_url, thumbnail and preview are blob/base64 URLs that the backend never
// stores. We keep them in localStorage keyed by scan_id so they survive reloads.
const MEDIA_CACHE_KEY = 'deepguard_media_cache'

function loadMediaCache() {
  try { return JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || '{}') } catch { return {} }
}

function saveMediaCache(cache) {
  try { localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function mergeMedia(results) {
  const cache = loadMediaCache()
  return results.map((r) => {
    const id = r.scan_id || r.id
    const cached = cache[id] || {}
    return {
      ...r,
      id,
      file_url:  r.file_url  || cached.file_url  || null,
      thumbnail: r.thumbnail || cached.thumbnail || null,
      preview:   r.preview   || cached.preview   || null,
      file_type: r.file_type || cached.file_type || 'image',
    }
  })
}

export function ResultsProvider({ children }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [user, setUser]       = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        fetchResults(u)
      } else {
        try {
          const stored = localStorage.getItem('deepguard_results')
          const parsed = stored ? JSON.parse(stored) : []
          setResults(mergeMedia(parsed))
        } catch {
          setResults([])
        }
      }
    })
    return unsub
  }, [])

  const fetchResults = async (u) => {
    setLoading(true)
    try {
      const token = await u.getIdToken()
      const res   = await fetch(`${API_BASE}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        // Merge backend data with locally cached media (thumbnails, file_urls)
        setResults(mergeMedia(data))
      }
    } catch (err) {
      console.error('Failed to fetch results from API:', err)
    } finally {
      setLoading(false)
    }
  }

  const addResult = (result) => {
    const id = result.scan_id || result.id
    const normalised = { ...result, id }

    // Cache the media fields locally so they survive reload
    if (result.file_url || result.thumbnail || result.preview) {
      const cache = loadMediaCache()
      cache[id] = {
        file_url:  result.file_url  || null,
        thumbnail: result.thumbnail || null,
        preview:   result.preview   || null,
        file_type: result.file_type || 'image',
      }
      saveMediaCache(cache)
    }
    setResults((prev) => {
      const updated = [normalised, ...prev]
      if (!user) localStorage.setItem('deepguard_results', JSON.stringify(updated))
      return updated
    })
  }

  const deleteResult = async (scanId) => {
    // Remove from media cache
    const cache = loadMediaCache()
    delete cache[scanId]
    saveMediaCache(cache)
    if (user) {
      try {
        const token = await user.getIdToken()
        await fetch(`${API_BASE}/results/${scanId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        console.error('Failed to delete from API:', err)
      }
    }
    setResults((prev) => {
      const updated = prev.filter(
        (r) => String(r.id) !== String(scanId) && String(r.scan_id) !== String(scanId)
      )
      if (!user) localStorage.setItem('deepguard_results', JSON.stringify(updated))
      return updated
    })
  }

  const clearResults = async () => {
    // Wipe media cache
    saveMediaCache({})
    if (user) {
      try {
        const token = await user.getIdToken()
        await Promise.allSettled(
          results.map((r) =>
            fetch(`${API_BASE}/results/${r.scan_id || r.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        )
      } catch (err) {
        console.error('Failed to clear results from API:', err)
      }
    }
    setResults([])
    localStorage.removeItem('deepguard_results')
  }

  return (
    <ResultsContext.Provider value={{ results, addResult, deleteResult, clearResults, loading }}>
      {children}
    </ResultsContext.Provider>
  )
}

export function useResults() {
  return useContext(ResultsContext)
}