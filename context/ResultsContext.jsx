'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

const ResultsContext = createContext()

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function ResultsProvider({ children }) {
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [user, setUser]         = useState(null)

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        fetchResults(u)
      } else {
        // Fall back to localStorage when signed out
        try {
          const stored = localStorage.getItem('deepguard_results')
          setResults(stored ? JSON.parse(stored) : [])
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
        // Normalise: backend uses scan_id, frontend uses id
        const normalised = data.map((r) => ({ ...r, id: r.scan_id }))
        setResults(normalised)
      }
    } catch (err) {
      console.error('Failed to fetch results from API:', err)
    } finally {
      setLoading(false)
    }
  }

  // Called immediately after a successful /scan response
  const addResult = (result) => {
    const normalised = { ...result, id: result.scan_id || result.id }
    setResults((prev) => {
      const updated = [normalised, ...prev]
      if (!user) localStorage.setItem('deepguard_results', JSON.stringify(updated))
      return updated
    })
  }

  const deleteResult = async (scanId) => {
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
      const updated = prev.filter((r) => String(r.id) !== String(scanId) && String(r.scan_id) !== String(scanId))
      if (!user) localStorage.setItem('deepguard_results', JSON.stringify(updated))
      return updated
    })
  }

  const clearResults = async () => {
    if (user) {
      try {
        const token = await user.getIdToken()
        await Promise.all(
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