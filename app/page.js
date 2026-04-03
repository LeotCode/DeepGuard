'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useResults } from '@/context/ResultsContext'
import ScanLoading from '@/components/ScanLoading'
import BlogCarousel from '@/components/BlogCarousel'

const NAVY   = '#12306b'
const DEEP_GRADIENT = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'
const DEEP_GRADIENT_HOVER = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'
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
      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '5.5rem 2.25rem 2rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.22fr) minmax(560px, 1.05fr)', gap: '2.5rem', alignItems: 'stretch' }}>

        {/* LEFT */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '28px', border: `1px solid ${BORDER}`, boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)', padding: '2.5rem', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ margin: '0 0 1.25rem', fontSize: '2.45rem', fontWeight: '900', color: TEXT, lineHeight: 1.1, fontFamily: FONT }}>
            What Makes Deepfakes Convincing?
          </h1>

          <p style={{ color: MUTED, fontSize: '1.18rem', lineHeight: 1.8, margin: '0 0 1.25rem', maxWidth: '620px', fontFamily: FONT }}>
            Deepfakes are edited or AI-generated images and videos designed to imitate real people. They often look believable because modern tools can mimic skin texture, lighting, and facial structure in seconds.
          </p>

          <p style={{ color: MUTED, fontSize: '1.18rem', lineHeight: 1.8, margin: '0 0 1.85rem', maxWidth: '620px', fontFamily: FONT }}>
            The hardest part is that small errors can be easy to miss. Look closely at edges, shadows, facial symmetry, background consistency, and skin detail. Comparing an authentic image next to an edited version helps train the eye.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: 'auto' }}>
            <div style={{ borderRadius: '24px', overflow: 'hidden', background: 'linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%)', border: `1px solid ${BORDER}`, padding: '1.2rem' }}>
              <p style={{ margin: '0 0 0.9rem', fontSize: '1.05rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>Real Image</p>
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80"
                alt="Real portrait example"
                style={{ width: '100%', height: '290px', objectFit: 'cover', borderRadius: '18px', display: 'block' }}
              />
            </div>

            <div style={{ borderRadius: '24px', overflow: 'hidden', background: 'linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%)', border: `1px solid ${BORDER}`, padding: '1.2rem' }}>
              <p style={{ margin: '0 0 0.9rem', fontSize: '1.05rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>Edited Version</p>
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80&sat=-100&contrast=130&blur=20"
                alt="Edited portrait example"
                style={{ width: '100%', height: '290px', objectFit: 'cover', borderRadius: '18px', display: 'block', filter: 'contrast(1.08) saturate(0.72) hue-rotate(-8deg)' }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: upload card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '28px', padding: '2.6rem', boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)', border: `1px solid ${BORDER}`, minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>Analyze Image File</h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !preview && fileInputRef.current.click()}
            style={{ border: `2px dashed ${dragging ? NAVY : '#cbd5e1'}`, borderRadius: '22px', padding: '2.8rem 2rem', textAlign: 'center', cursor: preview ? 'default' : 'pointer', backgroundColor: dragging ? `${NAVY}08` : '#f8fafc', transition: 'all 0.2s', marginBottom: '1.2rem', minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', flex: 1 }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" style={{ maxHeight: '250px', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain' }} />
                <button onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null) }} style={{ fontSize: '0.9rem', color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '0.45rem 0.95rem', cursor: 'pointer', fontFamily: FONT }}>Remove</button>
              </>
            ) : (
              <>
                <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '1.14rem', color: TEXT, fontFamily: FONT }}>Drop image file here or click to browse</p>
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current.click() }} style={{ marginTop: '0.35rem', padding: '0.75rem 1.9rem', background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.02rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 10px 22px rgba(15, 37, 87, 0.16)' }}>
                  Browse Files
                </button>
              </>
            )}
          </div>

          {/* Supported formats */}
          <p style={{ margin: '0 0 1.35rem', color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', fontFamily: FONT }}>
            Supports: JPEG, PNG · MP4, MOV, AVI, MKV · MP3, WAV, AAC
          </p>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,audio/mpeg,audio/wav,audio/aac" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

          <button onClick={handleScan} disabled={!selectedFile || loading} style={{ width: '100%', padding: '1.15rem', background: selectedFile && !loading ? DEEP_GRADIENT : '#e2e8f0', color: selectedFile && !loading ? '#fff' : '#94a3b8', border: 'none', borderRadius: '14px', fontSize: '1.14rem', fontWeight: '800', cursor: selectedFile && !loading ? 'pointer' : 'not-allowed', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background 0.2s', boxShadow: selectedFile && !loading ? '0 14px 28px rgba(15, 37, 87, 0.2)' : 'none' }} onMouseEnter={e => { if (selectedFile && !loading) e.currentTarget.style.background = DEEP_GRADIENT_HOVER }} onMouseLeave={e => { if (selectedFile && !loading) e.currentTarget.style.background = DEEP_GRADIENT }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            {loading ? 'Scanning...' : 'Start Detection'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1480px', margin: '0 auto', padding: '0 2.25rem 3rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 1rem', color: TEXT, fontSize: '1.28rem', fontWeight: '700', fontFamily: FONT }}>
            You think you can detect a deepfake? Try it out
          </p>
          <Link href="/game" style={{ textDecoration: 'none' }}>
            <button style={{ background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '12px', padding: '1rem 1.7rem', fontSize: '1.08rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 28px rgba(15, 37, 87, 0.16)' }}>
              Play The Game
            </button>
          </Link>
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
