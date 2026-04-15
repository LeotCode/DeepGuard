'use client'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/context/ThemeContext'

function getStages(fileType) {
  if (fileType === 'video') return [
    { label: 'Preprocessing video',      from: 0,  to: 18 },
    { label: 'Extracting frames',        from: 18, to: 38 },
    { label: 'Analyzing frame sequence', from: 38, to: 58 },
    { label: 'Running deepfake model',   from: 58, to: 82 },
    { label: 'Analyzing results',        from: 82, to: 96 },
    { label: 'Finalizing',               from: 96, to: 100 },
  ]
  if (fileType === 'audio') return [
    { label: 'Preprocessing audio',       from: 0,  to: 18 },
    { label: 'Extracting audio features', from: 18, to: 38 },
    { label: 'Analyzing patterns',        from: 38, to: 58 },
    { label: 'Running deepfake model',    from: 58, to: 82 },
    { label: 'Analyzing results',         from: 82, to: 96 },
    { label: 'Finalizing',                from: 96, to: 100 },
  ]
  return [
    { label: 'Preprocessing image',        from: 0,  to: 18 },
    { label: 'Detecting faces',            from: 18, to: 38 },
    { label: 'Extracting facial features', from: 38, to: 58 },
    { label: 'Running deepfake model',     from: 58, to: 82 },
    { label: 'Analyzing results',          from: 82, to: 96 },
    { label: 'Finalizing',                 from: 96, to: 100 },
  ]
}

const MAX_WAIT_MS = 120000 // 2 minute hard timeout

export default function ScanLoading({ scanDone, onComplete, fileType = 'image' }) {
  const { theme } = useTheme()
  const STAGES = getStages(fileType)
  const [progress, setProgress]     = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const currentRef    = useRef(0)
  const stageRef      = useRef(0)
  const scanDoneRef   = useRef(scanDone)
  const completedRef  = useRef(false)
  const startTimeRef  = useRef(Date.now())

  useEffect(() => { scanDoneRef.current = scanDone }, [scanDone])

  // When scanDone becomes true, immediately finish
  useEffect(() => {
    if (scanDone && !completedRef.current) {
      completedRef.current = true
      currentRef.current = 100
      setProgress(100)
      setStageIndex(STAGES.length - 1)
      setTimeout(() => onComplete?.(), 400)
    }
  }, [scanDone])

  useEffect(() => {
    const tick = setInterval(() => {
      const stage = STAGES[stageRef.current]
      if (!stage) return

      const elapsed = Date.now() - startTimeRef.current
      const isLastStage = stageRef.current === STAGES.length - 1

      // Hard timeout — force complete after MAX_WAIT_MS
      if (elapsed > MAX_WAIT_MS && !completedRef.current) {
        completedRef.current = true
        clearInterval(tick)
        onComplete?.()
        return
      }

      if (isLastStage && !scanDoneRef.current) {
        const holdAt = 99
        if (currentRef.current < holdAt) {
          const step = Math.max(0.2, (holdAt - currentRef.current) * 0.04)
          currentRef.current = Math.min(currentRef.current + step, holdAt)
          setProgress(Math.floor(currentRef.current))
        }
        return
      }

      const remaining = stage.to - currentRef.current
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