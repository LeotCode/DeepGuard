'use client'
import { useState, useEffect, useRef } from 'react'

const NAVY  = '#1e3a8a'
const BLUE  = '#2563eb'
const MUTED = '#64748b'
const TEXT  = '#0f172a'
const BG    = '#ffffff'
const TRACK = '#e2e8f0'

const STAGES = [
  { label: 'Preprocessing image',        from: 0,  to: 18 },
  { label: 'Detecting faces',            from: 18, to: 38 },
  { label: 'Extracting facial features', from: 38, to: 58 },
  { label: 'Running deepfake model',     from: 58, to: 82 },
  { label: 'Analyzing results',          from: 82, to: 96 },
  { label: 'Finalizing',                 from: 96, to: 100 },
]

export default function ScanLoading({ scanDone, onComplete }) {
  const [progress, setProgress]     = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const currentRef    = useRef(0)
  const stageRef      = useRef(0)
  const scanDoneRef   = useRef(scanDone)
  const completedRef  = useRef(false)

  useEffect(() => { scanDoneRef.current = scanDone }, [scanDone])

  useEffect(() => {
    const tick = setInterval(() => {
      const stage = STAGES[stageRef.current]
      if (!stage) return
      const isLastStage = stageRef.current === STAGES.length - 1
      const remaining   = stage.to - currentRef.current

      if (isLastStage && !scanDoneRef.current) {
        const holdAt = 99
        if (currentRef.current < holdAt) {
          const step = Math.max(0.2, (holdAt - currentRef.current) * 0.04)
          currentRef.current = Math.min(currentRef.current + step, holdAt)
          setProgress(Math.floor(currentRef.current))
        }
        return
      }

      const step = Math.max(0.3, remaining * 0.045)
      currentRef.current = Math.min(currentRef.current + step, stage.to)
      setProgress(Math.floor(currentRef.current))

      if (currentRef.current >= stage.to && stageRef.current < STAGES.length - 1) {
        stageRef.current++
        setStageIndex(stageRef.current)
      }

      if (currentRef.current >= 100 && !completedRef.current) {
        completedRef.current = true
        clearInterval(tick)
        setTimeout(() => onComplete?.(), 300)
      }
    }, 80)
    return () => clearInterval(tick)
  }, [])

  const currentStage = STAGES[stageIndex]

  return (
    <div style={{ width: '100%', maxWidth: '760px', marginTop: '1.5rem', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ backgroundColor: BG, border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem 2.5rem 2rem', boxShadow: '0 4px 24px rgba(30,58,138,0.08)' }}>

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <div>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: MUTED }}>
              Scanning
            </p>
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: TEXT, minHeight: '1.5rem' }}>
              {currentStage.label}
            </p>
          </div>
          <span style={{ fontSize: '2.5rem', fontWeight: '900', color: NAVY, letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {progress}%
          </span>
        </div>

        {/* Progress track */}
        <div style={{ width: '100%', height: '8px', backgroundColor: TRACK, borderRadius: '99px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${NAVY}, ${BLUE})`, borderRadius: '99px', transition: 'width 0.1s linear' }} />
        </div>

        {/* Stage dots */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {STAGES.map((stage, i) => {
            const done   = i < stageIndex
            const active = i === stageIndex
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: done ? NAVY : active ? TEXT : '#cbd5e1', fontWeight: active ? '700' : '400', transition: 'color 0.3s' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: done ? NAVY : active ? BLUE : '#cbd5e1', flexShrink: 0, transition: 'background-color 0.3s' }} />
                {stage.label}
                {i < STAGES.length - 1 && <span style={{ color: '#e2e8f0', margin: '0 2px' }}>·</span>}
              </div>
            )
          })}
        </div>

        {/* Pulse bar */}
        <div style={{ marginTop: '2rem', height: '3px', background: `linear-gradient(90deg, transparent, ${NAVY}, transparent)`, borderRadius: '99px', animation: 'pulse-bar 1.6s ease-in-out infinite' }} />
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