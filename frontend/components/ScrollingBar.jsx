'use client'
import { useTheme } from '@/context/ThemeContext'

const examples = [
  { label: 'FAKE', src: 'https://cdn.magzter.com/1406567956/1702509370/articles/xzQqyA8RY1702631023973/POPE-ONCE-A-VICTIM-OF-AIGENERATED-IMAGERY-CALLS-FOR-TREATY-TO-REGULATE-ARTIFICIAL-INTELLIGENCE.jpg', name: 'Example 1' },
  { label: 'REAL', src: 'https://www.theglobeandmail.com/resizer/v2/CIZZ3CUKMVMWVJJC66JVZGO4OI.jpg?auth=cf4951f0d96ff8947af3f4612a678a9f9976246d7c4ddf16037e0f876508d2a2&width=1200&quality=80', name: 'Example 2' },
  { label: 'FAKE', src: 'https://thispersonnotexist.org/downloadimage/Ac3RhdGljL3dvbWFuL3NlZWQxNDM5NC5qcGVn', name: 'Example 3' },
  { label: 'REAL', src: 'https://cdn.mos.cms.futurecdn.net/xRqbwS4odpkSQscn3jHECh.jpg', name: 'Example 4' },
  { label: 'FAKE', src: 'https://cdn.pixabay.com/photo/2024/05/28/16/39/ai-generated-8794203_1280.png', name: 'Example 5' },
  { label: 'REAL', src: 'data:image/jpeg;base64,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', name: 'Example 6' },
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
