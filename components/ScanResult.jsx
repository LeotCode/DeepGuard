'use client'
import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const NAVY   = '#1e3a8a'
const BLUE   = '#2563eb'
const TEXT   = '#0f172a'
const MUTED  = '#64748b'
const BG     = '#ffffff'
const SURFACE= '#f8fafc'
const BORDER = '#e2e8f0'
const FONT   = "'Jost', sans-serif"

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
  return <div style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden', marginBottom: '1.25rem', boxShadow: '0 2px 12px rgba(30,58,138,0.06)', fontFamily: FONT, ...style }}>{children}</div>
}
function CardHeader({ children }) {
  return <div style={{ padding: '1.1rem 1.5rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{children}</div>
}
function CardTitle({ children }) {
  return <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: TEXT, fontFamily: FONT }}>{children}</p>
}
function CardBody({ children }) {
  return <div style={{ padding: '1.25rem 1.5rem' }}>{children}</div>
}

function ScoreDisplay({ result }) {
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
              <svg style={{ transform: 'rotate(-90deg)', width: '200px', height: '200px' }} viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="88" stroke={BORDER} strokeWidth="10" fill="none" />
                <circle cx="100" cy="100" r="88" stroke={cfg.scoreColor} strokeWidth="10" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.05s linear' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: cfg.scoreColor }}><RiskIcon score={result.ai_score} size={28} /></span>
                <span style={{ fontSize: '3rem', fontWeight: '900', color: TEXT, lineHeight: 1, marginTop: '4px', fontFamily: FONT }}>{animScore}</span>
                <span style={{ fontSize: '0.9rem', color: MUTED, fontFamily: FONT }}>% AI</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>{cfg.likelihood}</h2>
              <p style={{ margin: 0, color: MUTED, lineHeight: 1.6, fontSize: '0.9rem', fontFamily: FONT }}>{cfg.description}</p>
            </div>

            <div style={{ backgroundColor: cfg.badgeBg, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: MUTED, fontFamily: FONT }}>Confidence Level</span>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: cfg.scoreColor, fontFamily: FONT }}>{result.confidence}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: BORDER, borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${result.confidence}%`, backgroundColor: cfg.scoreColor, borderRadius: '99px', transition: 'width 1s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[{ label: 'Media Type', value: result.file_type || 'Image', color: TEXT }, { label: 'Analysis Status', value: 'Complete', color: '#22c55e' }].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: '700', color, fontSize: '1rem', textTransform: 'capitalize', fontFamily: FONT }}>{value}</p>
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
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const avg  = (data.reduce((s, d) => s + d.ai_likelihood, 0) / data.length).toFixed(1)
  const peak = Math.max(...data.map(d => d.ai_likelihood)).toFixed(1)
  const low  = Math.min(...data.map(d => d.ai_likelihood)).toFixed(1)

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '0.75rem 1rem', fontFamily: FONT, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ margin: '0 0 4px', color: MUTED, fontSize: '0.78rem' }}>Time: {fmt(payload[0].payload.timestamp)}</p>
        <p style={{ margin: 0, color: TEXT, fontWeight: '700', fontSize: '0.9rem' }}>AI Likelihood: {payload[0].value.toFixed(1)}%</p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Temporal Analysis — AI Detection Over Time</CardTitle><span style={{ fontSize: '0.78rem', color: MUTED, fontFamily: FONT }}>Shows AI patterns over scan duration</span></CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={NAVY} stopOpacity={0.15} />
                <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="timestamp" tickFormatter={fmt} stroke={MUTED} tick={{ fontSize: 11, fill: MUTED, fontFamily: FONT }} />
            <YAxis domain={[0, 100]} stroke={MUTED} tick={{ fontSize: 11, fill: MUTED, fontFamily: FONT }} label={{ value: 'AI Likelihood (%)', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="ai_likelihood" stroke={NAVY} strokeWidth={2} fill="url(#aiGrad)" />
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
          {[{ label: 'Average', value: `${avg}%`, color: TEXT }, { label: 'Peak', value: `${peak}%`, color: '#ef4444' }, { label: 'Lowest', value: `${low}%`, color: '#22c55e' }].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.75rem 1rem', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}>{label}</p>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color, fontFamily: FONT }}>{value}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function HeatmapDisplay({ fileUrl, regions }) {
  const [show, setShow] = useState(true)
  const getColor = (i) => i >= 0.7 ? { fill: 'rgba(239,68,68,0.3)', stroke: '#ef4444' } : i >= 0.4 ? { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b' } : { fill: 'rgba(34,197,94,0.3)', stroke: '#22c55e' }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Spatial Heatmap Analysis</CardTitle>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: MUTED, fontFamily: FONT }}>Highlighted regions show potential AI manipulation</p>
        </div>
        <button onClick={() => setShow(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: SURFACE, border: `1px solid ${BORDER}`, color: MUTED, borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: FONT, fontWeight: '600' }}>
          {show ? 'Hide' : 'Show'}
        </button>
      </CardHeader>
      <CardBody>
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', backgroundColor: SURFACE, border: `1px solid ${BORDER}`, maxHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {fileUrl ? <img src={fileUrl} alt="Analysis" style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block' }} /> : <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '0.85rem', fontFamily: FONT }}>No image preview</div>}
          {show && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {regions.map((r, i) => { const c = getColor(r.intensity); return <rect key={i} x={`${r.x}%`} y={`${r.y}%`} width={`${r.width}%`} height={`${r.height}%`} fill={c.fill} stroke={c.stroke} strokeWidth="2" /> })}
            </svg>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
          {[{ color: '#ef4444', bg: 'rgba(239,68,68,0.2)', label: 'High' }, { color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', label: 'Medium' }, { color: '#22c55e', bg: 'rgba(34,197,94,0.2)', label: 'Low' }].map(({ color, bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: bg, border: `2px solid ${color}` }} />
              <span style={{ fontSize: '0.8rem', color: MUTED, fontFamily: FONT }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
          {[{ label: 'Total Regions', value: regions.length, color: TEXT }, { label: 'High Risk Areas', value: regions.filter(r => r.intensity >= 0.7).length, color: '#ef4444' }].map(({ label, value, color }) => (
            <div key={label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: FONT }}>{label}</p>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color, fontFamily: FONT }}>{value}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function RedFlagsList({ flags }) {
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
            ? <p style={{ textAlign: 'center', color: MUTED, padding: '1rem 0', fontSize: '0.85rem', fontFamily: FONT }}>No suspicious indicators found</p>
            : flags.map((flag, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0, marginTop: '5px' }} />
                <p style={{ margin: 0, color: TEXT, fontSize: '0.88rem', lineHeight: 1.55, fontFamily: FONT }}>{flag}</p>
              </div>
            ))
          }
        </div>
      </CardBody>
    </Card>
  )
}

function AnalysisSummary({ summary }) {
  return (
    <Card>
      <CardHeader><CardTitle>Analysis Summary</CardTitle></CardHeader>
      <CardBody><p style={{ margin: 0, color: MUTED, lineHeight: 1.7, fontSize: '0.9rem', fontFamily: FONT }}>{summary}</p></CardBody>
    </Card>
  )
}

function FileDetails({ result }) {
  return (
    <Card>
      <CardHeader><CardTitle>File Details</CardTitle></CardHeader>
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[{ label: 'Type', value: result.file_type || 'Image' }, { label: 'Confidence', value: `${result.confidence}%` }, { label: 'Faces Detected', value: result.total_faces }].map(({ label, value }) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: MUTED, fontFamily: FONT }}>{label}</p>
              <p style={{ margin: 0, fontWeight: '700', color: TEXT, textTransform: 'capitalize', fontFamily: FONT }}>{value}</p>
            </div>
          ))}
          {result.file_url && (
            <button onClick={() => window.open(result.file_url, '_blank')} style={{ marginTop: '0.25rem', width: '100%', padding: '0.65rem', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: FONT, fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              View Original File
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default function ScanResult({ result }) {
  const cfg = getRiskConfig(result.ai_score ?? 0)

  if (result.error) {
    return <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#ef4444', textAlign: 'center', width: '100%', maxWidth: '760px', fontFamily: FONT }}>{result.error}</div>
  }

  return (
    <div style={{ width: '100%', maxWidth: '1100px', marginTop: '1rem', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: '800', color: TEXT, fontFamily: FONT }}>{result.file_name || 'Scan Result'}</h1>
          <p style={{ margin: 0, color: MUTED, fontSize: '0.85rem', fontFamily: FONT }}>Analyzed on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: cfg.badgeBg, border: `1px solid ${cfg.badgeColor}44`, borderRadius: '99px', padding: '0.4rem 1rem', color: cfg.badgeColor, fontSize: '0.85rem', fontWeight: '700', fontFamily: FONT }}>
          <RiskIcon score={result.ai_score} size={15} />{cfg.label}
        </div>
      </div>

      <ScoreDisplay result={result} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
        <div>
          {result.temporal_data?.length > 0 && <TimelineGraph data={result.temporal_data} />}
          {result.heatmap_regions?.length > 0 && <HeatmapDisplay fileUrl={result.file_url} regions={result.heatmap_regions} />}
        </div>
        <div>
          {result.red_flags?.length > 0 && <RedFlagsList flags={result.red_flags} />}
          {result.analysis_summary && <AnalysisSummary summary={result.analysis_summary} />}
          <FileDetails result={result} />
        </div>
      </div>
    </div>
  )
}