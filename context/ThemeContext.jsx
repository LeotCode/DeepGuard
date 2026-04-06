'use client'
import { createContext, useContext, useState, useEffect, useMemo } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false)

  // Load persisted theme on client mount only to keep SSR and hydration consistent
  useEffect(() => {
    const saved = localStorage.getItem('deepguard-dark-mode')
    if (saved !== null) {
      setDarkMode(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage when darkMode changes
  useEffect(() => {
    localStorage.setItem('deepguard-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode(prev => !prev)

  const theme = useMemo(() => ({
    bg: darkMode ? '#0f172a' : '#f4f6fb',
    cardBg: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#0f172a',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: darkMode ? '#3b82f6' : '#1e3a8a',
    boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(30,58,138,0.05)',
    muted: '#64748b'
  }), [darkMode])

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}