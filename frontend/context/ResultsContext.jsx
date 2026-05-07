'use client'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { loadMedia, deleteMedia, clearAllMedia } from '@/lib/mediaCache'

const ResultsContext = createContext()
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── helpers ──────────────────────────────────────────────────────────────────

// Returns true only for URLs that are self-contained and survive page reload.
// data: URLs (base64) are fine. blob: URLs die on reload — treat as missing.
function isLiveUrl(val) {
  return typeof val === 'string' && val.startsWith('data:')
}

// Strip anything that won't survive a reload before writing to localStorage.
function persistableUrl(val) {
  return isLiveUrl(val) ? val : null
}

// ── metadata localStorage cache ───────────────────────────────────────────────
// Stores ONLY: file_type, spectrogram_image, and base64 thumbnail.
// Never stores blob: URLs — they die on reload and poison the hydration check.
const META_KEY = 'deepguard_media_cache'

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') } catch { return {} }
}
function saveMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)) } catch {}
}

// Merge API/localStorage result list with our metadata cache.
// All blob: URLs are intentionally stripped here — IndexedDB will restore them.
function mergeMedia(results) {
  const meta = loadMeta()
  return results.map((r) => {
    const id = String(r.scan_id || r.id)
    const m  = meta[id] || {}
    const specSession = (() => { try { return sessionStorage.getItem(`deepguard_spectrogram_${id}`) } catch { return null } })()
    return {
      ...r,
      id,
      file_url:          persistableUrl(r.file_url)   || persistableUrl(m.file_url)   || null,
      preview:           persistableUrl(r.preview)    || persistableUrl(m.preview)    || null,
      thumbnail:         persistableUrl(r.thumbnail)  || persistableUrl(m.thumbnail)  || null,
      file_type:         r.file_type  || m.file_type  || 'image',
      spectrogram_image: r.spectrogram_image || m.spectrogram_image || specSession || null,
    }
  })
}

// After setting results, hit IndexedDB for every entry that has no live URL yet.
// This is the only place blob URLs re-enter the React state after a reload.
async function hydrateFromIndexedDB(results, setResults) {
  const updates = await Promise.all(
    results.map(async (r) => {
      // Already has a working URL this session — skip
      if (isLiveUrl(r.file_url)) return null
      // Images stored as base64 are already covered by isLiveUrl above.
      // For video/audio the file_url will be null after reload → look up IndexedDB.
      const id  = String(r.scan_id || r.id)
      const url = await loadMedia(id)
      if (!url) return null
      return { id, url }
    })
  )
  if (!updates.some(Boolean)) return
  setResults((prev) =>
    prev.map((r) => {
      const hit = updates.find((u) => u && u.id === String(r.scan_id || r.id))
      if (!hit) return r
      return { ...r, file_url: hit.url, preview: hit.url, thumbnail: r.thumbnail || hit.url }
    })
  )
}

// ── provider ─────────────────────────────────────────────────────────────────

export function ResultsProvider({ children }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [user, setUser]       = useState(null)
  const userRef               = useRef(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      userRef.current = u
      if (u) {
        fetchResults(u)
      } else {
        try {
          const stored = localStorage.getItem('deepguard_results')
          const parsed = stored ? JSON.parse(stored) : []
          const merged = mergeMedia(parsed)
          setResults(merged)
          hydrateFromIndexedDB(merged, setResults)
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
      const res   = await fetch(`${API_BASE}/results`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data   = await res.json()
        const merged = mergeMedia(data)
        setResults(merged)
        hydrateFromIndexedDB(merged, setResults)
      }
    } catch (err) {
      console.error('fetchResults failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const addResult = (result) => {
    const id         = String(result.scan_id || result.id)
    const stableDate = result.date || (
      result.scanned_at
        ? new Date(result.scanned_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    )

    // Persist metadata (safe values only — no blob URLs)
    const meta = loadMeta()
    meta[id] = {
      file_type:         result.file_type         || 'image',
      spectrogram_image: result.spectrogram_image || null,
      // Only keep thumbnail if it's base64 — blob URLs die on reload
      thumbnail:         persistableUrl(result.thumbnail) || null,
      // For images, preview IS a base64 data URL and is safe to keep
      file_url:          persistableUrl(result.file_url)  || null,
      preview:           persistableUrl(result.preview)   || null,
    }
    saveMeta(meta)

    const normalised = { ...result, id, date: stableDate }

    setResults((prev) => {
      const updated = [normalised, ...prev]
      if (!userRef.current) {
        // Write to localStorage with blob URLs stripped
        const safe = updated.map((r) => ({
          ...r,
          file_url:  persistableUrl(r.file_url),
          preview:   persistableUrl(r.preview),
          thumbnail: persistableUrl(r.thumbnail),
        }))
        try { localStorage.setItem('deepguard_results', JSON.stringify(safe)) } catch {}
      }
      return updated
    })
  }

  const deleteResult = async (scanId) => {
    const id = String(scanId)
    deleteMedia(id)
    const meta = loadMeta()
    delete meta[id]
    saveMeta(meta)

    if (userRef.current) {
      try {
        const token = await userRef.current.getIdToken()
        await fetch(`${API_BASE}/results/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      } catch (err) { console.error('deleteResult API failed:', err) }
    }

    setResults((prev) => {
      const updated = prev.filter((r) => String(r.id) !== id && String(r.scan_id) !== id)
      if (!userRef.current) {
        const safe = updated.map((r) => ({ ...r, file_url: persistableUrl(r.file_url), preview: persistableUrl(r.preview), thumbnail: persistableUrl(r.thumbnail) }))
        try { localStorage.setItem('deepguard_results', JSON.stringify(safe)) } catch {}
      }
      return updated
    })
  }

  const clearResults = async () => {
    clearAllMedia()
    saveMeta({})
    if (userRef.current) {
      try {
        const token = await userRef.current.getIdToken()
        await Promise.allSettled(
          results.map((r) => fetch(`${API_BASE}/results/${r.scan_id || r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }))
        )
      } catch (err) { console.error('clearResults API failed:', err) }
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