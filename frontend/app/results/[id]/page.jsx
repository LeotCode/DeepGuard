'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useResults } from '@/context/ResultsContext'
import { useTheme } from '@/context/ThemeContext'
import ScanResult from '@/components/ScanResult'

export default function ResultDetailPage({ params }) {
  const { id }     = use(params)
  const { results } = useResults()
  const router      = useRouter()
  const { theme }   = useTheme()
  const result      = results.find((r) => String(r.id) === String(id))

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontFamily: "'Jost', sans-serif", transition: 'background-color 0.3s ease' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <h2 style={{ color: theme.text, margin: 0, fontWeight: '800', fontSize: '1.4rem', transition: 'color 0.3s ease' }}>Result Not Found</h2>
        <p style={{ color: theme.muted, margin: 0, fontSize: '0.9rem', transition: 'color 0.3s ease' }}>This scan may have been cleared or doesn&apos;t exist.</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '0.5rem', padding: '0.65rem 1.5rem', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: '700', fontSize: '0.9rem', transition: 'background-color 0.3s ease' }}>
          Back to Scanner
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '2rem 2rem 4rem', fontFamily: "'Jost', sans-serif", transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/results')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent', border: 'none', color: theme.muted, cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '0.9rem', fontWeight: '600', marginBottom: '1.75rem', padding: 0, transition: 'color 0.3s ease' }}
          onMouseEnter={e => e.currentTarget.style.color = theme.primary}
          onMouseLeave={e => e.currentTarget.style.color = theme.muted}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Results
        </button>
        <ScanResult result={result} />
      </div>
    </div>
  )
}