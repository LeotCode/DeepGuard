'use client'
import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '@/context/ThemeContext'

const FONT   = "'Jost', sans-serif"

function CustomTooltip({ theme, fmt, active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '0.75rem 1rem', fontFamily: FONT, boxShadow: theme.boxShadow, transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease' }}>
      <p style={{ margin: '0 0 4px', color: theme.muted, fontSize: '0.78rem', transition: 'color 0.3s ease' }}>Time: {fmt(payload[0].payload.timestamp)}</p>
      <p style={{ margin: 0, color: theme.text, fontWeight: '700', fontSize: '0.9rem', transition: 'color 0.3s ease' }}>AI Likelihood: {payload[0].value.toFixed(1)}%</p>
    </div>
  )
}

function getRiskConfig(score) {
  if (score >= 70) return { label: 'High Risk',   badgeColor: '#ef4444', badgeBg: '#fef2f2', scoreColor: '#ef4444', likelihood: 'High AI Likelihood',     description: 'This content shows strong indicators of AI generation or manipulation.' }
  if (score >= 40) return { label: 'Medium Risk', badgeColor: '#f59e0b', badgeBg: '#fffbeb', scoreColor: '#f59e0b', likelihood: 'Moderate AI Likelihood', description: 'Some suspicious patterns detected. Further investigation recommended.' }
  return              { label: 'Low Risk',    badgeColor: '#22c55e', badgeBg: '#f0fdf4', scoreColor: '#22c55e', likelihood: 'Low AI Likelihood',      description: 'Content appears authentic with minimal signs of AI manipulation.' }
}

function RiskIcon({ score, size = 20 }) {
  if (score >= 70) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  if (score >= 40) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}

function Card({ children, style = {} }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '20px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: theme.boxShadow, fontFamily: FONT, transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease', ...style }}>{children}</div>
}
function CardHeader({ children }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <div style={{ padding: '1.35rem 1.8rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.3s ease' }}>{children}</div>
}
function CardTitle({ children }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <p style={{ margin: 0, fontWeight: '700', fontSize: '1.15rem', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>{children}</p>
}
function CardBody({ children }) {
  return <div style={{ padding: '1.6rem 1.8rem' }}>{children}</div>
}

function ScoreDisplay({ result }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const cfg = getRiskConfig(result.ai_score)
  const [animScore, setAnimScore] = useState(0)
  const circumference = 2 * Math.PI * 88

  useEffect(() => {
    let start = null
    const target = result.ai_score
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1000, 1)
      setAnimScore(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
      else setAnimScore(target)
    }
    requestAnimationFrame(step)
  }, [result.ai_score])

  const offset = circumference - (animScore / 100) * circumference

  return (
    <Card>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '2.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '240px', height: '240px' }}>
              <svg style={{ transform: 'rotate(-90deg)', width: '240px', height: '240px' }} viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="88" stroke={theme.border} strokeWidth="10" fill="none" />
                <circle cx="100" cy="100" r="88" stroke={cfg.scoreColor} strokeWidth="10" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.05s linear' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: cfg.scoreColor }}><RiskIcon score={result.ai_score} size={34} /></span>
                <span style={{ fontSize: '3.6rem', fontWeight: '900', color: theme.text, lineHeight: 1, marginTop: '6px', fontFamily: FONT, transition: 'color 0.3s ease' }}>{animScore}</span>
                <span style={{ fontSize: '1.02rem', color: theme.muted, fontFamily: FONT, transition: 'color 0.3s ease' }}>% AI</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.45rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.65rem', fontSize: '2rem', fontWeight: '800', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>{cfg.likelihood}</h2>
              <p style={{ margin: 0, color: theme.muted, lineHeight: 1.7, fontSize: '1.02rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>{cfg.description}</p>
            </div>



            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              {[{ label: 'Media Type', value: result.file_type || 'Image', color: theme.text }, { label: 'Analysis Status', value: 'Complete', color: '#22c55e' }].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '1rem 1.1rem', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '0.78rem', color: theme.muted, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT, transition: 'color 0.3s ease' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: '700', color, fontSize: '1.08rem', textTransform: 'capitalize', fontFamily: FONT }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function TimelineGraph({ data }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const avg  = (data.reduce((s, d) => s + d.ai_likelihood, 0) / data.length).toFixed(1)
  const peak = Math.max(...data.map(d => d.ai_likelihood)).toFixed(1)
  const low  = Math.min(...data.map(d => d.ai_likelihood)).toFixed(1)

  return (
    <Card>
      <CardHeader><CardTitle>Temporal Analysis — AI Detection Over Time</CardTitle><span style={{ fontSize: '0.88rem', color: theme.muted, fontFamily: FONT, transition: 'color 0.3s ease' }}>Shows AI patterns over scan duration</span></CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.primary} stopOpacity={0.15} />
                <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis dataKey="timestamp" tickFormatter={fmt} stroke={theme.muted} tick={{ fontSize: 12, fill: theme.muted, fontFamily: FONT }} />
            <YAxis domain={[0, 100]} stroke={theme.muted} tick={{ fontSize: 12, fill: theme.muted, fontFamily: FONT }} label={{ value: 'AI Likelihood (%)', angle: -90, position: 'insideLeft', fill: theme.muted, fontSize: 12 }} />
            <Tooltip content={(props) => <CustomTooltip theme={theme} fmt={fmt} {...props} />} />
            <Area type="monotone" dataKey="ai_likelihood" stroke={theme.primary} strokeWidth={3} fill="url(#aiGrad)" />
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.9rem', marginTop: '1.5rem' }}>
          {[{ label: 'Average', value: `${avg}%`, color: theme.text }, { label: 'Peak', value: `${peak}%`, color: '#ef4444' }, { label: 'Lowest', value: `${low}%`, color: '#22c55e' }].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '0.95rem 1.1rem', textAlign: 'center', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
              <p style={{ margin: '0 0 5px', fontSize: '0.78rem', color: theme.muted, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT, transition: 'color 0.3s ease' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '1.28rem', fontWeight: '700', color, fontFamily: FONT }}>{value}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function HeatmapDisplay({ fileUrl, fileType, regions, scanId }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [show, setShow] = useState(true)
  const [liveUrl, setLiveUrl] = useState(fileUrl)

  useEffect(() => {
    if (!scanId) { setLiveUrl(fileUrl); return }
    if (fileType === 'video' || fileType === 'audio') {
      const stored = sessionStorage.getItem(`deepguard_video_${scanId}`)
      setLiveUrl(stored || fileUrl)
    } else {
      // Images: sessionStorage blob URL survives navigation, direct blob URL does not
      const stored = sessionStorage.getItem(`deepguard_media_${scanId}`)
      setLiveUrl(stored || fileUrl)
    }
  }, [fileUrl, fileType, scanId])

  const isImage = !fileType || fileType === 'image'
  const getColor = (i) => i >= 0.7 ? { fill: 'rgba(239,68,68,0.3)', stroke: '#ef4444' } : i >= 0.4 ? { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b' } : { fill: 'rgba(34,197,94,0.3)', stroke: '#22c55e' }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{isImage ? 'Spatial Heatmap Analysis' : 'Media Preview'}</CardTitle>
          <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: theme.muted, fontFamily: FONT, transition: 'color 0.3s ease' }}>
            {isImage ? 'Highlighted regions show potential AI manipulation' : 'Scanned media file'}
          </p>
        </div>
        {isImage && (
          <button onClick={() => setShow(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: '10px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem', fontFamily: FONT, fontWeight: '600', transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease' }}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </CardHeader>
      <CardBody>
        {/* Media area */}
        <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000', border: `1px solid ${theme.border}`, transition: 'border-color 0.3s ease' }}>
          {liveUrl ? (
            fileType === 'video' ? (
              // Use a wrapper div with intrinsic aspect ratio so portrait (9:16)
              // and landscape (16:9) videos both display correctly without black bars.
              // The video fills the wrapper; the browser picks the right height from metadata.
              <div style={{ position: 'relative', width: '100%' }}>
                <video
                  src={liveUrl}
                  controls
                  style={{
                    display: 'block',
                    width: '100%',
                    // max-height caps landscape; height:auto lets portrait expand naturally
                    maxHeight: '520px',
                    height: 'auto',
                    backgroundColor: '#000',
                  }}
                />
              </div>
            ) : fileType === 'audio' ? (
              <div style={{ padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', backgroundColor: theme.bg }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
                <audio src={liveUrl} controls style={{ width: '100%', maxWidth: '420px' }} />
              </div>
            ) : (
              // Image with heatmap overlay
              // inline-block so wrapper shrinks to image size, preventing SVG from covering letterbox bars
              <div style={{ position: 'relative', display: 'inline-block', width: '100%', lineHeight: 0 }}>
                <img
                  src={liveUrl}
                  alt="Analysis"
                  style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
                />
                {show && regions.length > 0 && (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    {regions.map((r, i) => {
                      const c = getColor(r.intensity)
                      return <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} fill={c.fill} stroke={c.stroke} strokeWidth="0.5" />
                    })}
                  </svg>
                )}
              </div>
            )
          ) : (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.muted, fontSize: '0.95rem', fontFamily: FONT, backgroundColor: theme.bg }}>
              No preview available
            </div>
          )}
        </div>

        {/* Legend + stats — only relevant for images */}
        {isImage && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.75rem', marginTop: '1.2rem' }}>
              {[{ color: '#ef4444', bg: 'rgba(239,68,68,0.2)', label: 'High' }, { color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', label: 'Medium' }, { color: '#22c55e', bg: 'rgba(34,197,94,0.2)', label: 'Low' }].map(({ color, bg, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: bg, border: `2px solid ${color}` }} />
                  <span style={{ fontSize: '0.92rem', color: theme.muted, fontFamily: FONT, transition: 'color 0.3s ease' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginTop: '1.2rem' }}>
              {[{ label: 'Total Regions', value: regions.length, color: theme.text }, { label: 'High Risk Areas', value: regions.filter(r => r.intensity >= 0.7).length, color: '#ef4444' }].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '1rem 1.1rem', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '0.78rem', color: theme.muted, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT, transition: 'color 0.3s ease' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: '1.7rem', fontWeight: '700', color, fontFamily: FONT }}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function RedFlagsList({ flags }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <CardTitle>Red Flags Detected</CardTitle>
        </div>
      </CardHeader>
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {flags.length === 0
            ? <p style={{ textAlign: 'center', color: theme.muted, padding: '1.1rem 0', fontSize: '0.95rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>No suspicious indicators found</p>
            : flags.map((flag, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '0.95rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0, marginTop: '7px' }} />
                <p style={{ margin: 0, color: '#7f1d1d', fontSize: '1rem', lineHeight: 1.65, fontFamily: FONT }}>{flag}</p>
              </div>
            ))
          }
        </div>
      </CardBody>
    </Card>
  )
}

function AnalysisSummary({ summary }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <Card>
      <CardHeader><CardTitle>Analysis Summary</CardTitle></CardHeader>
      <CardBody><p style={{ margin: 0, color: theme.muted, lineHeight: 1.8, fontSize: '1.02rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>{summary}</p></CardBody>
    </Card>
  )
}

export default function ScanResult({ result }) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const cfg = getRiskConfig(result.ai_score ?? 0)

  if (result.error) {
    return <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#ef4444', textAlign: 'center', width: '100%', maxWidth: '760px', fontFamily: FONT }}>{result.error}</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: '1260px', marginTop: '1.25rem', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.8rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '2rem', fontWeight: '800', color: theme.text, fontFamily: FONT, transition: 'color 0.3s ease' }}>{result.file_name || 'Scan Result'}</h1>
          <p suppressHydrationWarning style={{ margin: 0, color: theme.muted, fontSize: '0.96rem', fontFamily: FONT, transition: 'color 0.3s ease' }}>
            Analyzed on {mounted ? (() => {
              const ts = result.created_at || result.scanned_at
              if (!ts) return result.date || 'Unknown date'
              try { return new Date(ts).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
              catch { return result.date || ts }
            })() : (result.date || '...')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: cfg.badgeBg, border: `1px solid ${cfg.badgeColor}44`, borderRadius: '99px', padding: '0.55rem 1.15rem', color: cfg.badgeColor, fontSize: '0.94rem', fontWeight: '700', fontFamily: FONT }}>
          <RiskIcon score={result.ai_score} size={17} />{cfg.label}
        </div>
      </div>

      <ScoreDisplay result={result} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        <div>
          {result.temporal_data?.length > 0 && <TimelineGraph data={result.temporal_data} />}
          {(result.file_type === 'video' || result.file_type === 'audio' || result.file_type === 'image' || result.heatmap_regions?.length > 0) && (
            <HeatmapDisplay
              fileUrl={result.file_url}
              fileType={result.file_type}
              regions={result.heatmap_regions || []}
              scanId={result.id || result.scan_id}
            />
          )}
        </div>
        <div>
          {result.analysis_summary && <AnalysisSummary summary={result.analysis_summary} />}
          <RedFlagsList flags={result.red_flags || []} />
        </div>
      </div>
    </div>
  )
}