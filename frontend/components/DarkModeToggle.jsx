'use client'
import { useTheme } from '@/context/ThemeContext'

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode, theme } = useTheme()

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
    }}>
      <button
        onClick={toggleDarkMode}
        style={{
          width: '50px',
          height: '50px',
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: theme.boxShadow,
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease, transform 0.1s ease',
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {darkMode ? '🌙' : '☀️'}
      </button>
    </div>
  )
}