'use client'
import { useResults } from '@/context/ResultsContext'
import { useRouter } from 'next/navigation'

const NAVY   = '#1e3a8a'
const BLUE   = '#2563eb'
const TEXT   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const BG     = '#f4f6fb'
const FONT   = "'Jost', sans-serif"

export default function Results() {
  const { results, clearResults } = useResults()
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, padding: '3rem 2rem', fontFamily: FONT }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: TEXT, margin: 0, fontFamily: FONT }}>
              Scan <span style={{ color: NAVY }}>History</span>
            </h1>
            <p style={{ color: MUTED, marginTop: '0.4rem', fontSize: '0.95rem', fontFamily: FONT }}>
              Your previous deepfake detections
            </p>
          </div>
          {results.length > 0 && (
            <button onClick={clearResults} style={{ padding: '0.5rem 1.25rem', backgroundColor: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', fontFamily: FONT, transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {results.map((item) => {
            const top    = item.predictions?.[0]
            const isFake = top?.label === 'fake'
            const color  = isFake ? '#ef4444' : '#22c55e'
            const bgBadge= isFake ? '#fef2f2' : '#f0fdf4'

            return (
              <div
                key={item.id}
                onClick={() => router.push(`/results/${item.id}`)}
                style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(30,58,138,0.06)', transition: 'box-shadow 0.2s, transform 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(30,58,138,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(30,58,138,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Thumbnail */}
                <div style={{ width: '100%', height: '160px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  <img src={item.preview} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                {/* Info */}
                <div style={{ padding: '1rem' }}>
                  <p style={{ color: TEXT, margin: '0 0 0.6rem', fontSize: '0.88rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: FONT }}>
                    {item.filename}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ backgroundColor: bgBadge, color, fontSize: '0.72rem', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '99px', fontFamily: FONT }}>
                      {top?.label || 'N/A'}
                    </span>
                    <span style={{ color: MUTED, fontSize: '0.78rem', fontFamily: FONT }}>
                      {top?.confidence?.toFixed(1)}%
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ backgroundColor: BORDER, borderRadius: '4px', height: '4px' }}>
                    <div style={{ height: '100%', width: `${top?.confidence}%`, backgroundColor: color, borderRadius: '4px' }} />
                  </div>

                  <p style={{ color: MUTED, fontSize: '0.75rem', margin: '0.6rem 0 0', fontFamily: FONT }}>
                    {item.date} · {item.total_faces} face(s)
                  </p>
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {results.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 2rem', color: MUTED, fontFamily: FONT }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: '600', color: TEXT, fontFamily: FONT }}>No scans yet</p>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', fontFamily: FONT }}>Upload an image on the home page to get started.</p>
              <button onClick={() => router.push('/')} style={{ padding: '0.65rem 1.5rem', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: FONT, fontWeight: '700', fontSize: '0.9rem' }}>
                Go to Scanner
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}