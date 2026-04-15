'use client'
import { useTheme } from '@/context/ThemeContext'

const MUTED  = '#64748b'
const FONT   = "'Jost', sans-serif"

const SETTINGS = [
  { key: 'darkMode',        label: 'Dark Mode',          description: 'Switch to dark theme' },
  { key: 'notifications',   label: 'Notifications',      description: 'Receive alerts for scan results' },
  { key: 'saveResults',     label: 'Save Results',       description: 'Automatically save scan history' },
  { key: 'highAccuracy',    label: 'High Accuracy Mode', description: 'Slower but more precise detection' }
]

function Toggle({ on, onToggle, primaryColor }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: '46px', height: '26px',
        backgroundColor: on ? primaryColor : '#cbd5e1',
        borderRadius: '13px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.3s ease',
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
        transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }} />
    </div>
  )
}

export default function Settings() {
  const { darkMode, toggleDarkMode, theme } = useTheme()

  // For other settings, we might need local state or another context, but for now, just darkMode
  // Since only darkMode is implemented, we'll handle others later if needed

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '1.5rem 2rem', fontFamily: FONT, transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: theme.text, margin: 0, transition: 'color 0.3s ease' }}>
            <span style={{ color: theme.primary, transition: 'color 0.3s ease' }}>Settings</span>
          </h1>
          <p style={{ color: MUTED, marginTop: '0.4rem', fontSize: '0.95rem' }}>
            Manage your DeepGuard preferences
          </p>
        </div>

        {/* Settings cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {SETTINGS.map(({ key, label, description }) => (
            <div
              key={key}
              style={{ 
                backgroundColor: theme.cardBg, 
                border: `1px solid ${theme.border}`, 
                borderRadius: '14px', 
                padding: '1rem 1.25rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: '1rem', 
                boxShadow: theme.boxShadow,
                transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              <div>
                <p style={{ color: theme.text, margin: 0, fontWeight: '700', fontSize: '1rem', transition: 'color 0.3s ease' }}>{label}</p>
                <p style={{ color: MUTED, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{description}</p>
              </div>
              <Toggle 
                on={key === 'darkMode' ? darkMode : false} // For now, only darkMode is toggled
                onToggle={key === 'darkMode' ? toggleDarkMode : () => {}} // Placeholder for others
                primaryColor={theme.primary}
              />
            </div>
          ))}
        </div>

        {/* Save button - maybe not needed if auto-save */}
        <button
          style={{ 
            marginTop: '1.25rem', 
            width: '100%', 
            padding: '0.75rem', 
            backgroundColor: theme.primary, 
            color: '#fff', 
            border: 'none', 
            borderRadius: '12px', 
            fontSize: '1rem', 
            fontWeight: '800', 
            cursor: 'pointer', 
            fontFamily: FONT, 
            transition: 'background-color 0.3s ease' 
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = darkMode ? '#60a5fa' : '#2563eb'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.primary}
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}