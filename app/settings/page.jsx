'use client'
import { useState } from 'react'

const NAVY   = '#1e3a8a'
const TEXT   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const BG     = '#f4f6fb'
const FONT   = "'Jost', sans-serif"

const SETTINGS = [
  { key: 'notifications',   label: 'Notifications',       description: 'Receive alerts for scan results' },
  { key: 'saveResults',     label: 'Save Results',         description: 'Automatically save scan history' },
  { key: 'highAccuracy',    label: 'High Accuracy Mode',   description: 'Slower but more precise detection' },
]

function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: '46px', height: '26px',
        backgroundColor: on ? NAVY : '#cbd5e1',
        borderRadius: '13px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: on ? '23px' : '3px',
        width: '20px', height: '20px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }} />
    </div>
  )
}

export default function Settings() {
  const [enabled, setEnabled] = useState({ notifications: true, saveResults: true, highAccuracy: false })

  const toggle = (key) => setEnabled(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, padding: '3rem 2rem', fontFamily: FONT }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', color: TEXT, margin: 0, fontFamily: FONT }}>
            <span style={{ color: NAVY }}>Settings</span>
          </h1>
          <p style={{ color: MUTED, marginTop: '0.4rem', fontSize: '0.95rem', fontFamily: FONT }}>
            Manage your DeepGuard preferences
          </p>
        </div>

        {/* Settings cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {SETTINGS.map(({ key, label, description }) => (
            <div
              key={key}
              style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '1.4rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 12px rgba(30,58,138,0.05)' }}
            >
              <div>
                <p style={{ color: TEXT, margin: 0, fontWeight: '700', fontSize: '1rem', fontFamily: FONT }}>{label}</p>
                <p style={{ color: MUTED, margin: '0.25rem 0 0', fontSize: '0.85rem', fontFamily: FONT }}>{description}</p>
              </div>
              <Toggle on={enabled[key]} onToggle={() => toggle(key)} />
            </div>
          ))}
        </div>

        {/* Save button */}
        <button
          style={{ marginTop: '2rem', width: '100%', padding: '0.9rem', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = NAVY}
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}