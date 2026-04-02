'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useResults } from '@/context/ResultsContext'
import ScanLoading from '@/components/ScanLoading'
import BlogCarousel from '@/components/BlogCarousel'

const NAVY   = '#1e3a8a'
const BLUE   = '#2563eb'
const TEXT   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const FONT   = "'Jost', sans-serif"

const MOCK_RESULT = {
  total_faces: 1,
  predictions: [{ face: 1, label: 'fake', confidence: 78.4 }],
  ai_score: 78, confidence: 85, file_type: 'image',
  red_flags: ['Unusual facial texture', 'Inconsistent lighting on face and background', 'Slight blurring around the edges of facial features'],
  analysis_summary: 'The image exhibits some characteristics typical of manipulated content, such as minor texture inconsistencies and lighting mismatches. However, these do not strongly indicate AI generation, suggesting it may be an authentic photograph with slight imperfections.',
  temporal_data: Array.from({ length: 22 }, (_, i) => ({ timestamp: i * 5, ai_likelihood: 13 + Math.sin(i * 0.7) * 7 + Math.random() * 5 })),
  heatmap_regions: [{ x: 48, y: 38, width: 18, height: 22, intensity: 0.3 }, { x: 30, y: 58, width: 14, height: 16, intensity: 0.25 }],
}

const features = [
  'Detects deepfake faces and images from all major AI models',
  'Pixel-level spatial heatmap analysis of suspicious regions',
  'Confidence scoring with detailed red flag breakdown',
]

export default function Home() {
  const [loading, setLoading]           = useState(false)
  const [scanDone, setScanDone]         = useState(false)
  const [pendingId, setPendingId]       = useState(null)
  const [preview, setPreview]           = useState(null)
  const [dragging, setDragging]         = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  const { addResult } = useResults()
  const router = useRouter()

  const handleFile = (file) => {
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  const handleScan = async () => {
    if (!selectedFile) return
    setLoading(true); setScanDone(false)
    setTimeout(() => {
      document.getElementById('scan-loading')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    try {
      const id = Date.now(); setPendingId(id)
      await new Promise((r) => setTimeout(r, 4200))
      const data = { ...MOCK_RESULT, file_name: selectedFile.name, file_url: preview }
      addResult({ id, filename: selectedFile.name, preview, predictions: data.predictions, total_faces: data.total_faces, ai_score: data.ai_score, confidence: data.confidence, red_flags: data.red_flags, analysis_summary: data.analysis_summary, temporal_data: data.temporal_data, heatmap_regions: data.heatmap_regions, file_url: preview, file_type: 'image', date: new Date().toLocaleDateString() })
      setScanDone(true)
    } catch { setLoading(false); setScanDone(false); alert('Scan failed.') }
  }

  const handleScanComplete = () => { if (pendingId) router.push(`/results/${pendingId}`) }

  return (
    <div style={{ background: '#f4f6fb', minHeight: '100vh', fontFamily: FONT }}>

      {/* Hero */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '5rem 2rem 4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>

        {/* LEFT */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: `${NAVY}12`, border: `1px solid ${NAVY}30`, color: NAVY, borderRadius: '99px', padding: '0.35rem 1rem', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '1.5rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Advanced Deepfake Detection
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', fontWeight: '900', color: TEXT, lineHeight: 1.15, margin: '0 0 1.25rem', fontFamily: FONT }}>
            Be Protected Against Deepfake
          </h1>

          <p style={{ color: MUTED, fontSize: '1.05rem', lineHeight: 1.7, margin: '0 0 2rem', maxWidth: '480px', fontFamily: FONT }}>
            We offer an AI tool that can identify if an image is real or deepfake with high accuracy.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {features.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span style={{ color: TEXT, fontSize: '0.97rem', lineHeight: 1.5, fontFamily: FONT }}>{f}</span>
              </li>
            ))}
          </ul>

          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = NAVY} onMouseLeave={e => e.currentTarget.style.backgroundColor = BLUE}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Start Scanning
          </button>
        </div>

        {/* RIGHT: upload card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 24px rgba(30,58,138,0.08)', border: `1px solid ${BORDER}` }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>Analyze Image File</h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !preview && fileInputRef.current.click()}
            style={{ border: `2px dashed ${dragging ? NAVY : '#cbd5e1'}`, borderRadius: '14px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: preview ? 'default' : 'pointer', backgroundColor: dragging ? `${NAVY}08` : '#f8fafc', transition: 'all 0.2s', marginBottom: '0.75rem', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }} />
                <button onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null) }} style={{ fontSize: '0.75rem', color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontFamily: FONT }}>Remove</button>
              </>
            ) : (
              <>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '1rem', color: TEXT, fontFamily: FONT }}>Drop image file here or click to browse</p>
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current.click() }} style={{ marginTop: '0.25rem', padding: '0.55rem 1.75rem', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT }}>
                  Browse Files
                </button>
              </>
            )}
          </div>

          {/* Supported formats */}
          <p style={{ margin: '0 0 1.25rem', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', fontFamily: FONT }}>
            Supports: JPEG, PNG · MP4, MOV, AVI, MKV · MP3, WAV, AAC
          </p>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,audio/mpeg,audio/wav,audio/aac" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

          <button onClick={handleScan} disabled={!selectedFile || loading} style={{ width: '100%', padding: '1rem', backgroundColor: selectedFile && !loading ? NAVY : '#e2e8f0', color: selectedFile && !loading ? '#fff' : '#94a3b8', border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '800', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }} onMouseEnter={e => { if (selectedFile && !loading) e.currentTarget.style.backgroundColor = BLUE }} onMouseLeave={e => { if (selectedFile && !loading) e.currentTarget.style.backgroundColor = NAVY }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            {loading ? 'Scanning...' : 'Start Detection'}
          </button>
        </div>
      </div>

      {loading && (
        <div id="scan-loading" style={{ maxWidth: '760px', margin: '0 auto', padding: '0 2rem 3rem' }}>
          <ScanLoading scanDone={scanDone} onComplete={handleScanComplete} />
        </div>
      )}

      {!loading && <BlogCarousel />}
    </div>
  )
}