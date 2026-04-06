'use client'
import { useTheme } from '@/context/ThemeContext'
import DeepfakeGame from '@/components/DeepfakeGame'

export default function GamePage() {
  const { theme } = useTheme()

  return (
    <div style={{
      background: theme.bg,
      color: theme.text,
      minHeight: '100vh',
      padding: '5rem 2rem 3rem',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      <DeepfakeGame />
    </div>
  )
}
