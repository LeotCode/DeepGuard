'use client'
import { useTheme } from '@/context/ThemeContext'
import DeepfakeGame from '@/components/DeepfakeGame'

export default function GamePage() {
  const { theme } = useTheme()

  return (
    <div style={{
      background: theme.bg,
      color: theme.text,
      height: 'calc(100vh - 72px)',
      padding: '1.5rem 0.5rem 1rem',
      overflow: 'hidden',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      <DeepfakeGame />
    </div>
  )
}
