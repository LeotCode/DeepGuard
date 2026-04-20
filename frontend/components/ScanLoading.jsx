'use client'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/context/ThemeContext'

function getStages(fileType) {
  if (fileType === 'video') return [
    { label: 'Preprocessing video',      pct: 15 },
    { label: 'Extracting frames',        pct: 25 },
    { label: 'Analyzing frame sequence', pct: 20 },
    { label: 'Running deepfake model',   pct: 25 },
    { label: 'Analyzing results',        pct: 10 },
    { label: 'Finalizing',               pct: 5  },
  ]
  if (fileType === 'audio') return [
    { label: 'Preprocessing audio',       pct: 15 },
    { label: 'Extracting audio features', pct: 25 },
    { label: 'Analyzing patterns',        pct: 20 },
    { label: 'Running deepfake model',    pct: 25 },
    { label: 'Analyzing results',         pct: 10 },
    { label: 'Finalizing',               pct: 5  },
  ]
  return [
    { label: 'Preprocessing image',        pct: 15 },
    { label: 'Detecting faces',            pct: 20 },
    { label: 'Extracting facial features', pct: 20 },
    { label: 'Running deepfake model',     pct: 30 },
    { label: 'Analyzing results',          pct: 10 },
    { label: 'Finalizing',                pct: 5  },
  ]
}

// Expected scan durations in ms — progress paces itself to reach ~92%
// by this time, leaving headroom for the real response to arrive.
const EXPECTED_MS = {
  image: 8000,
  video: 25000,
  audio: 12000,
}

const MAX_WAIT_MS = 120000

export default function ScanLoading({ scanDone, onComplete, fileType = 'image' }) {
  const { theme } = useTheme()
  const STAGES = getStages(fileType)

  // Build cumulative breakpoints from pct weights
  const breakpoints = STAGES.reduce((acc, s, i) => {
    const prev = acc[i - 1] ?? 0
    acc.push(prev + s.pct)
    return acc
  }, []).map(v => (v / 100) * 92) // scale to 92% max so we hold for real response

  const [progress, setProgress]     = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const progressRef   = useRef(0)
  const scanDoneRef   = useRef(scanDone)
  const completedRef  = useRef(false)
  const startTimeRef  = useRef(Date.now())
  const expectedMs    = EXPECTED_MS[fileType] ?? EXPECTED_MS.image

  useEffect(() => { scanDoneRef.current = scanDone }, [scanDone])

  // When scan finishes, animate smoothly to 100% then navigate
  useEffect(() => {
    if (!scanDone || completedRef.current) return
    completedRef.current = true

    // Animate from current to 100% over 500ms
    const start    = progressRef.current
    const startTs  = performance.now()
    const duration = 500

    const animate = (now) => {
      const t = Math.min((now - startTs) / duration, 1)
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease-in-out
      const val = Math.round(start + (100 - start) * eased)
      progressRef.current = val
      setProgress(val)
      setStageIndex(STAGES.length - 1)
      if (t < 1) requestAnimationFrame(animate)
      else setTimeout(() => onComplete?.(), 150)
    }
    requestAnimationFrame(animate)
  }, [scanDone])

  // Time-based progress: advance smoothly toward 92% over expectedMs
  useEffect(() => {
    const tick = setInterval(() => {
      if (completedRef.current) { clearInterval(tick); return }

      const elapsed  = Date.now() - startTimeRef.current
      const fraction = Math.min(elapsed / expectedMs, 1)

      // Hard timeout
      if (elapsed > MAX_WAIT_MS && !completedRef.current) {
        completedRef.current = true
        clearInterval(tick)
        onComplete?.()
        return
      }

      // Ease the fraction so it slows near the ceiling (never reaches 92% before scan done)
      const eased   = 1 - Math.pow(1 - fraction, 2.2)
      const target  = Math.min(eased * 92, 92)
      const current = progressRef.current

      // Smooth toward target — never go backwards
      if (target > current) {
        const next = Math.min(current + Math.max(0.3, (target - current) * 0.12), target)
        progressRef.current = next
        setProgress(Math.floor(next))

        // Update stage based on breakpoints
        for (let i = breakpoints.length - 1; i >= 0; i--) {
          if (next >= breakpoints[i]) {
            if (i + 1 !== stageIndex) setStageIndex(Math.min(i + 1, STAGES.length - 1))
            break
          }
        }
      }
    }, 80)
    return () => clearInterval(tick)
  }, [expectedMs])

  const currentStage = STAGES[stageIndex] ?? STAGES[STAGES.length - 1]

  return (
    <div style={{ width: '100%', maxWidth: '760px', marginTop: '1.5rem', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '2.5rem 2.5rem 2rem', boxShadow: theme.boxShadow, transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' }}>

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <div>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: theme.muted, transition: 'color 0.3s ease' }}>
              Scanning
            </p>
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: theme.text, minHeight: '1.5rem', transition: 'color 0.3s ease' }}>
              {currentStage.label}
            </p>
          </div>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: theme.primary, letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s ease' }}>
            {progress}%
          </span>
        </div>

        {/* Progress track */}
        <div style={{ width: '100%', height: '8px', backgroundColor: theme.border, borderRadius: '99px', overflow: 'hidden', marginBottom: '1.5rem', transition: 'background-color 0.3s ease' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.primary})`, borderRadius: '99px', transition: 'width 0.1s linear' }} />
        </div>

        {/* Stage dots */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {STAGES.map((stage, i) => {
            const done   = i < stageIndex
            const active = i === stageIndex
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: done ? theme.primary : active ? theme.text : '#cbd5e1', fontWeight: active ? '700' : '400', transition: 'color 0.3s' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: done ? theme.primary : active ? theme.primary : '#cbd5e1', flexShrink: 0, transition: 'background-color 0.3s' }} />
                {stage.label}
                {i < STAGES.length - 1 && <span style={{ color: '#e2e8f0', margin: '0 2px' }}>·</span>}
              </div>
            )
          })}
        </div>

        {/* Pulse bar */}
        <div style={{ marginTop: '2rem', height: '3px', background: `linear-gradient(90deg, transparent, ${theme.primary}, transparent)`, borderRadius: '99px', animation: 'pulse-bar 1.6s ease-in-out infinite' }} />
      </div>

      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 0.15; transform: scaleX(0.6); }
          50%       { opacity: 1;   transform: scaleX(1); }
        }
      `}</style>
    </div>
  )
}