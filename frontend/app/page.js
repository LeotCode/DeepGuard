'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useResults } from '@/context/ResultsContext'
import { useTheme } from '@/context/ThemeContext'
import ScanLoading from '@/components/ScanLoading'
import BlogCarousel from '@/components/BlogCarousel'
import FAQ from '@/components/FAQ'
import { auth } from '@/lib/firebase'
import { saveMedia } from '@/lib/mediaCache'

const DEEP_GRADIENT = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'
const DEEP_GRADIENT_HOVER = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'
const FONT = "'Jost', sans-serif"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function Home() {
  const { theme } = useTheme()
  const [loading, setLoading]           = useState(false)
  const [scanDone, setScanDone]         = useState(false)
  const [pendingId, setPendingId]       = useState(null)
  const [preview, setPreview]           = useState(null)
  const [dragging, setDragging]         = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileType, setFileType]         = useState('image')
  const [thumbnail, setThumbnail]       = useState(null)
  const [error, setError]               = useState(null)
  const fileInputRef = useRef(null)
  const { addResult } = useResults()
  const router = useRouter()

  const handleFile = (file) => {
    if (!file) return
    const ft = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image'
    setSelectedFile(file)
    setFileType(ft)
    setError(null)
    if (ft === 'image') {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(file)
    } else if (ft === 'video') {
      const blobUrl = URL.createObjectURL(file)
      setPreview(blobUrl)

      // Capture a thumbnail — must wait for metadata to get duration,
      // then seek, then draw on the seeked event.
      const vid = document.createElement('video')
      vid.muted = true
      vid.playsInline = true
      vid.preload = 'metadata'

      const drawFrame = () => {
        try {
          const w = vid.videoWidth  || 640
          const h = vid.videoHeight || 360
          const canvas = document.createElement('canvas')
          canvas.width  = w
          canvas.height = h
          canvas.getContext('2d').drawImage(vid, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          // Only accept if we actually got image data (not a blank frame)
          if (dataUrl && dataUrl.length > 5000) {
            setThumbnail(dataUrl)
          }
        } catch (_) {}
      }

      vid.addEventListener('loadedmetadata', () => {
        // Seek to 10% or 1s, whichever is smaller
        vid.currentTime = Math.min(1, (vid.duration || 10) * 0.1)
      })

      vid.addEventListener('seeked', () => {
        drawFrame()
        vid.src = ''
      })

      // Fallback: if seeked never fires (some browsers/codecs),
      // try drawing immediately when enough data is available
      vid.addEventListener('canplay', () => {
        if (!vid.currentTime) {
          drawFrame()
        }
      })

      vid.src = blobUrl
      vid.load()
    } else {
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  const handleScan = async () => {
    if (!selectedFile) return
    setLoading(true); setScanDone(false); setError(null)
    setTimeout(() => {
      document.getElementById('scan-loading')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    try {
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
      const id = data.scan_id || Date.now()
      setPendingId(id)

      // Persist the file binary in IndexedDB so a fresh blob URL can be
      // recreated after a full page reload.  Blob URLs die when the page unloads;
      // IndexedDB is the only storage that handles large binaries (video/audio).
      let resultFileUrl = preview
      if (selectedFile) {
        const cachedUrl = await saveMedia(id, selectedFile)
        if (cachedUrl) resultFileUrl = cachedUrl
        // Spectrogram is a small base64 string — sessionStorage is fine for it
        if (data.spectrogram_image) {
          try { sessionStorage.setItem(`deepguard_spectrogram_${id}`, data.spectrogram_image) } catch (_) {}
        }
      }

      addResult({
        id,
        scan_id: data.scan_id,
        filename: selectedFile.name,
        // Only pass preview if it's base64 (images). Blob URLs die on reload.
        preview: preview && preview.startsWith('data:') ? preview : null,
        // Only pass thumbnail if it's the canvas-captured base64 dataURL.
        thumbnail: thumbnail && thumbnail.startsWith('data:') ? thumbnail : null,
        predictions: data.predictions || [],
        total_faces: data.total_faces ?? 0,
        ai_score: data.ai_score,
        confidence: data.confidence,
        red_flags: data.red_flags || [],
        analysis_summary: data.analysis_summary || '',
        temporal_data: data.temporal_data || [],
        heatmap_regions: data.heatmap_regions || [],
        model_scores: data.model_scores || [],
        file_url: resultFileUrl,
        file_type: data.file_type || 'image',
        is_deepfake: data.is_deepfake,
        frames_analyzed: data.frames_analyzed,
        spectrogram_image: data.spectrogram_image || null,
        created_at: data.created_at || new Date().toISOString(),
        date: data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString(),
      })

      setScanDone(true)
    } catch (err) {
      setLoading(false)
      setScanDone(false)
      setError(err.message || 'Scan failed. Please try again.')
    }
  }

  const handleScanComplete = () => { if (pendingId) router.push(`/results/${pendingId}`) }

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', fontFamily: FONT, transition: 'background-color 0.3s ease' }}>

      {/* Hero */}
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '1.5rem 1.5rem 1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.22fr) minmax(500px, 1.05fr)', gap: '1.5rem', alignItems: 'stretch' }}>

        {/* LEFT */}
        <div style={{ backgroundColor: theme.cardBg, borderRadius: '28px', border: `1px solid ${theme.border}`, boxShadow: theme.boxShadow, padding: '1.5rem', minHeight: '100%', display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' }}>
          <h1 style={{ margin: '0 0 1.25rem', fontSize: '2.45rem', fontWeight: '900', color: theme.text, lineHeight: 1.1, fontFamily: FONT, transition: 'color 0.3s ease' }}>
            What Makes Deepfakes Convincing?
          </h1>

          <p style={{ color: theme.muted, fontSize: '1.18rem', lineHeight: 1.8, margin: '0 0 0.75rem', maxWidth: '620px', fontFamily: FONT, transition: 'color 0.3s ease' }}>
            Deepfakes are edited or AI-generated content designed to imitate real people. They often look believable because modern tools can mimic skin texture, lighting, and facial structure in seconds.
          </p>

          <p style={{ color: theme.muted, fontSize: '1.18rem', lineHeight: 1.8, margin: '0 0 1rem', maxWidth: '620px', fontFamily: FONT, transition: 'color 0.3s ease' }}>
            The hardest part is that small errors can be easy to miss. Look closely at edges, shadows, facial symmetry, background consistency, and skin detail. Comparing an authentic image next to an edited version helps train the eye.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: 'auto' }}>
            <div style={{ borderRadius: '24px', overflow: 'hidden', background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '0.8rem', transition: 'border-color 0.3s ease' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', fontWeight: '800', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>Real Image</p>
              <img
                src="/images/real_guy.png"
                alt="Real portrait example"
                style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '18px', display: 'block' }}
              />
            </div>

            <div style={{ borderRadius: '24px', overflow: 'hidden', background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '0.8rem', transition: 'border-color 0.3s ease' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', fontWeight: '800', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>Edited Version</p>
              <img
                src="/images/deepfake_tom.png"
                alt="Edited portrait example"
                style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '18px', display: 'block', filter: 'contrast(1.08) saturate(0.72) hue-rotate(-8deg)' }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: upload card */}
        <div style={{ backgroundColor: theme.cardBg, borderRadius: '28px', padding: '1.5rem', boxShadow: theme.boxShadow, border: `1px solid ${theme.border}`, minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>Analyze Image/Video/Audio File</h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !preview && fileInputRef.current.click()}
            style={{ border: `2px dashed ${dragging ? theme.primary : '#cbd5e1'}`, borderRadius: '22px', padding: '1.5rem 1.2rem', textAlign: 'center', cursor: preview ? 'default' : 'pointer', backgroundColor: dragging ? `${theme.primary}08` : theme.cardBg, transition: 'all 0.2s', marginBottom: '0.8rem', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.8rem', flex: 1 }}
          >
            {preview ? (
              <>
                {fileType === 'video' ? (
                  <video src={preview} controls playsInline style={{ width: '100%', height: 'auto', maxHeight: '280px', borderRadius: '12px', backgroundColor: '#000', display: 'block' }} />
                ) : fileType === 'audio' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                    </svg>
                    <audio src={preview} controls style={{ width: '100%', maxWidth: '340px' }} />
                  </div>
                ) : (
                  <img src={preview} alt="Preview" style={{ maxHeight: '250px', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain' }} />
                )}
                <button onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null); setFileType('image'); setThumbnail(null); setError(null) }} style={{ fontSize: '0.9rem', color: theme.muted, background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '0.45rem 0.95rem', cursor: 'pointer', fontFamily: FONT, transition: 'color 0.3s ease, border-color 0.3s ease' }}>Remove</button>
              </>
            ) : (
              <>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>Drop image, video, or audio here</p>
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current.click() }} style={{ marginTop: '0.25rem', padding: '0.6rem 1.5rem', background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 10px 22px rgba(15, 37, 87, 0.16)' }}>
                  Browse Files
                </button>
              </>
            )}
          </div>

          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', fontFamily: FONT }}>
              ⚠ {error}
            </div>
          )}

          {/* Supported formats */}
          <p style={{ margin: '0 0 0.8rem', color: theme.muted, fontSize: '0.75rem', textAlign: 'center', fontFamily: FONT }}>
            Supports: JPEG, PNG · MP4, MOV, AVI, MKV · MP3, WAV, AAC
          </p>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,audio/mpeg,audio/wav,audio/aac" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

          <button onClick={handleScan} disabled={!selectedFile || loading} style={{ width: '100%', padding: '0.9rem', background: selectedFile && !loading ? DEEP_GRADIENT : theme.border, color: selectedFile && !loading ? '#fff' : theme.muted, border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: '800', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background 0.2s', boxShadow: selectedFile && !loading ? '0 14px 28px rgba(15, 37, 87, 0.2)' : 'none' }} onMouseEnter={e => { if (selectedFile && !loading) e.currentTarget.style.background = DEEP_GRADIENT_HOVER }} onMouseLeave={e => { if (selectedFile && !loading) e.currentTarget.style.background = DEEP_GRADIENT }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            {loading ? 'Scanning...' : 'Start Detection'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0 1.5rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.8rem', color: theme.text, fontSize: '1.1rem', fontWeight: '700', fontFamily: FONT }}>
            You think you can detect a deepfake? Try it out
          </p>
          <Link href="/game" style={{ textDecoration: 'none' }}>
            <button style={{ background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '12px', padding: '0.8rem 1.4rem', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 28px rgba(15, 37, 87, 0.16)' }}>
              Play The Game
            </button>
          </Link>
        </div>
      </div>

      {loading && (
        <div id="scan-loading" style={{ maxWidth: '760px', margin: '0 auto', padding: '0 1rem 2rem' }}>
          <ScanLoading scanDone={scanDone} onComplete={handleScanComplete} fileType={fileType} />
        </div>
      )}

      {!loading && <BlogCarousel />}
      {!loading && <FAQ />}
    </div>
  )
}