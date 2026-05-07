'use client'
import { useState, useEffect } from 'react'
import { useResults } from '@/context/ResultsContext'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

const FONT = "'Jost', sans-serif"

export default function Results() {
  const { results, clearResults, deleteResult } = useResults()
  const router = useRouter()
  const { theme } = useTheme()
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u))
    return () => unsub()
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '3rem 2rem', fontFamily: FONT, transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: theme.text, margin: 0, fontFamily: FONT, transition: 'color 0.3s ease' }}>
              Scan <span style={{ color: theme.primary, transition: 'color 0.3s ease' }}>History</span>
            </h1>
            <p style={{ color: theme.muted, marginTop: '0.4rem', fontSize: '0.95rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>
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

        {/* Guest — show sign-in prompt, no history */}
        {user === null ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: theme.muted, fontFamily: FONT }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: '700', color: theme.text, fontFamily: FONT }}>Sign in to view your scan history</p>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', fontFamily: FONT }}>Scan history is only available for registered users. Your scans are saved securely to your account.</p>
            <button
              onClick={() => router.push('/auth')}
              style={{ padding: '0.7rem 2rem', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: FONT, fontWeight: '700', fontSize: '0.95rem' }}
            >
              Sign In / Create Account
            </button>
          </div>
        ) : (

        <>{/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {results.map((item) => {
            const top     = item.predictions?.[0]
            // Videos have no per-face predictions — use ai_score + is_deepfake instead
            const score   = item.ai_score ?? top?.confidence ?? 0
            const isVideo = item.file_type === 'video' || item.file_type === 'audio'
            const isFake  = item.ai_score != null ? item.ai_score > 50 : (item.is_deepfake ?? false)
            const label   = isFake ? 'Fake' : 'Real'
            const color   = isFake ? '#ef4444' : '#22c55e'
            const bgBadge = isFake ? '#fef2f2' : '#f0fdf4'

            return (
              <div
                key={item.id}
                onClick={() => router.push(`/results/${item.id}`)}
                style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', boxShadow: theme.boxShadow, position: 'relative', transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(30,58,138,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = theme.boxShadow; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <button
                  onClick={e => { e.stopPropagation(); deleteResult(item.scan_id || item.id) }}
                  title="Delete scan"
                  style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 20, width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                {/* Thumbnail */}
                <div style={{ width: '100%', height: '160px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                  {item.file_type === 'audio' ? (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                      <span style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '1.5px', fontFamily: FONT }}>AUDIO</span>
                    </div>
                  ) : item.file_type === 'video' ? (() => {
                    const sid = item.id || item.scan_id
                    const thumb = (item.thumbnail && !item.thumbnail.startsWith('blob:')) ? item.thumbnail
                      : (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`deepguard_thumbnail_${sid}`) : null)
                    return (
                      <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {thumb ? (
                          <img src={thumb} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        )}
                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: '4px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: '700', fontFamily: "'Jost', sans-serif" }}>VIDEO</span>
                        </div>
                      </div>
                    )
                  })() : (() => {
                    const sid = item.id || item.scan_id
                    const imgSrc = (item.thumbnail && !item.thumbnail.startsWith('blob:')) ? item.thumbnail
                      : (item.preview && !item.preview.startsWith('blob:')) ? item.preview
                      : (typeof sessionStorage !== 'undefined'
                          ? sessionStorage.getItem(`deepguard_media_${sid}`) || sessionStorage.getItem(`deepguard_thumbnail_${sid}`)
                          : null)
                      || item.thumbnail || item.preview
                    return imgSrc ? (
                      <img src={imgSrc} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                    )
                  })()}
                </div>

                {/* Info */}
                <div style={{ padding: '1rem' }}>
                  <p style={{ color: theme.text, margin: '0 0 0.6rem', fontSize: '0.88rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: FONT, transition: 'color 0.3s ease' }}>
                    {item.filename}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ backgroundColor: bgBadge, color, fontSize: '0.72rem', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '99px', fontFamily: FONT }}>
                      {label}
                    </span>
                    <span style={{ color: theme.muted, fontSize: '0.78rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>
                      {score > 0 ? score.toFixed(1) + '%' : ''}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ backgroundColor: theme.border, borderRadius: '4px', height: '4px', transition: 'background-color 0.3s ease' }}>
                    <div style={{ height: '100%', width: `${score}%`, backgroundColor: color, borderRadius: '4px' }} />
                  </div>

                  <p style={{ color: theme.muted, fontSize: '0.75rem', margin: '0.6rem 0 0', fontFamily: FONT, transition: 'color 0.3s ease' }}>
                    {item.date} · {item.total_faces} face(s)
                  </p>
                </div>
              </div>
            )
          })}

          {/* Empty state — logged in but no scans yet */}
          {results.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 2rem', color: theme.muted, fontFamily: FONT, transition: 'color 0.3s ease' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <p style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: '600', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>No scans yet</p>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', fontFamily: FONT }}>Upload an image on the home page to get started.</p>
              <button onClick={() => router.push('/')} style={{ padding: '0.65rem 1.5rem', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: FONT, fontWeight: '700', fontSize: '0.9rem', transition: 'background-color 0.3s ease' }}>
                Go to Scanner
              </button>
            </div>
          )}
        </div>
        </>
        )} {/* end guest check */}
      </div>
    </div>
  )
}