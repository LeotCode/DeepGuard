'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useResults } from '@/context/ResultsContext'
import { auth } from '@/lib/firebase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ImageUpload({ loading, setLoading, scanDone, setScanDone, pendingId, setPendingId }) {
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const { addResult } = useResults()
  const router = useRouter()

  const handleFile = (file) => {
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleScan = async () => {
    if (!selectedFile) return
    setLoading(true)
    setScanDone(false)
    setError(null)

    try {
      const id = Date.now()
      setPendingId(id)

      // Get Firebase auth token
      const user = auth.currentUser
      const token = user ? await user.getIdToken() : null

      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()

      addResult({
        id: data.scan_id || id,
        filename: selectedFile.name,
        preview,
        predictions: data.predictions || [],
        total_faces: data.total_faces ?? 0,
        ai_score: data.ai_score,
        confidence: data.confidence,
        red_flags: data.red_flags || [],
        analysis_summary: data.analysis_summary || '',
        temporal_data: data.temporal_data || [],
        heatmap_regions: data.heatmap_regions || [],
        model_scores: data.model_scores || [],
        file_url: preview,
        file_type: data.file_type || 'image',
        is_deepfake: data.is_deepfake,
        frames_analyzed: data.frames_analyzed,
        date: new Date().toLocaleDateString(),
      })

      setScanDone(true)
    } catch (err) {
      setLoading(false)
      setScanDone(false)
      setError(err.message || 'Scan failed. Please try again.')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '760px' }}>
      <div style={{ backgroundColor: '#161b27', border: '1px solid #21293a', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.25rem' }}>
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #21293a' }}>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '1rem', color: '#e0e6f0' }}>Upload File</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current.click()}
          style={{ margin: '1.5rem', border: `1.5px dashed ${dragging ? '#3b82f6' : '#2a3448'}`, borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', cursor: preview ? 'default' : 'pointer', backgroundColor: dragging ? 'rgba(59,130,246,0.06)' : '#111827', transition: 'all 0.2s', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}
        >
          {preview ? (
            <>
              <img src={preview} alt="Preview" style={{ maxHeight: '220px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} />
              <button onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null); setError(null) }} style={{ fontSize: '0.75rem', color: '#4b5e78', background: 'transparent', border: '1px solid #21293a', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Remove
              </button>
            </>
          ) : (
            <>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#1e2d45', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: '0 0 0.35rem', fontWeight: '600', fontSize: '1.1rem', color: '#e0e6f0' }}>Drop your file here</p>
                <p style={{ margin: 0, color: '#4b5e78', fontSize: '0.9rem' }}>or click to browse</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current.click() }} style={{ marginTop: '0.5rem', padding: '0.6rem 1.75rem', background: 'linear-gradient(135deg, #2563eb, #38bdf8)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Select File
              </button>
              <p style={{ margin: 0, color: '#2e3d52', fontSize: '0.75rem' }}>Supports: JPEG, PNG, MP4, MOV, WEBM</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

      <button onClick={handleScan} disabled={!selectedFile || loading} style={{ width: '100%', padding: '0.9rem', backgroundColor: selectedFile && !loading ? '#2563eb' : '#161b27', color: selectedFile && !loading ? '#fff' : '#2e3d52', border: `1px solid ${selectedFile && !loading ? '#2563eb' : '#21293a'}`, borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: 'inherit' }}>
        {loading ? 'Scanning...' : 'Scan File'}
      </button>
    </div>
  )
}