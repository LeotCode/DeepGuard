'use client'
import { useTheme } from '@/context/ThemeContext'

const examples = [
  { label: 'FAKE', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg', name: 'Example 1' },
  { label: 'REAL', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/400px-PNG_transparency_demonstration_1.png', name: 'Example 2' },
  { label: 'FAKE', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg', name: 'Example 3' },
  { label: 'REAL', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/400px-PNG_transparency_demonstration_1.png', name: 'Example 4' },
  { label: 'FAKE', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg', name: 'Example 5' },
  { label: 'REAL', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/400px-PNG_transparency_demonstration_1.png', name: 'Example 6' },
]

const doubled = [...examples, ...examples]

const NAVY = '#1e3a8a'
const FAKE_COLOR = '#ef4444'
const REAL_COLOR = '#22c55e'

export default function ScrollingBar() {
  const { theme } = useTheme()

  return (
    <div style={{
      width: '100%',
      backgroundColor: theme.bg,
      borderTop: `1px solid ${theme.border}`,
      overflow: 'hidden',
      padding: '1.3rem 0 1.15rem',
      fontFamily: "'Jost', sans-serif",
    }}>
      <p style={{
        textAlign: 'center',
        color: theme.muted,
        fontSize: '0.78rem',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        margin: '0 0 1rem 0',
        fontFamily: "'Jost', sans-serif",
        fontWeight: '700',
      }}>
        Example Detections
      </p>

      <div style={{ overflow: 'hidden', width: '100%' }}>
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          animation: 'scroll 40s linear infinite',
          width: 'max-content',
        }}>
          {doubled.map((item, index) => {
            const isFake = item.label === 'FAKE'
            const color  = isFake ? FAKE_COLOR : REAL_COLOR
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <div style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: `2px solid ${color}55`,
                  boxShadow: `0 4px 14px ${color}22`,
                }}>
                  <img src={item.src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  letterSpacing: '2px',
                  color,
                  textTransform: 'uppercase',
                  fontFamily: "'Jost', sans-serif",
                }}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
