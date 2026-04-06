'use client'
import { useState, useEffect } from 'react'
import { useTheme } from '@/context/ThemeContext'

const posts = [
  { tag: 'THREAT LANDSCAPE', title: 'Deepfakes Are Weaponized Daily',     body: 'AI-generated media is no longer a research curiosity. Political misinformation, financial fraud, and identity theft now leverage convincing synthetic faces that fool the human eye in under a second.', stat: '96%',   statLabel: 'of deepfakes target real individuals' },
  { tag: 'WHY IT MATTERS',   title: "Your Eyes Can't Be Trusted",         body: 'The human brain is wired to trust faces. Deepfake creators exploit this. Detection requires pixel-level analysis of subtle artifacts — compression ghosts, blink asymmetry, lighting inconsistencies — invisible to casual viewers.', stat: '500M+', statLabel: 'synthetic media pieces created in 2024' },
  { tag: 'THE SOLUTION',     title: 'Machine Vision Fights Back',         body: 'Modern detection models analyze spatial-temporal inconsistencies, flag GAN fingerprints, and cross-reference metadata — catching what humans miss in milliseconds.', stat: '0.3s',  statLabel: 'average DeepGuard scan time per image' },
  { tag: 'REAL STAKES',      title: 'Legal, Political & Personal Harm',   body: 'Fake evidence in courtrooms. Fabricated statements from world leaders. Non-consensual synthetic imagery. Deepfakes are a societal crisis that demands automated defenses.', stat: '$12B',  statLabel: 'fraud enabled by synthetic media by 2027' },
]

const FONT   = "'Jost', sans-serif"

export default function BlogCarousel() {
  const { theme } = useTheme()
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)
  const [dir, setDir]       = useState('right')

  const goTo = (index, direction = 'right') => {
    if (fading || index === active) return
    setDir(direction)
    setFading(true)
    setTimeout(() => { setActive(index); setFading(false) }, 300)
  }

  const next = () => goTo((active + 1) % posts.length, 'right')
  const prev = () => goTo((active - 1 + posts.length) % posts.length, 'left')

  useEffect(() => {
    const id = setInterval(next, 5500)
    return () => clearInterval(id)
  }, [active])

  const post = posts[active]

  return (
    <section style={{ width: '100%', backgroundColor: theme.bg, borderTop: `1px solid ${theme.border}`, padding: '5rem 2rem', boxSizing: 'border-box', fontFamily: FONT, transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <p style={{ color: theme.muted, fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 0.75rem 0', fontWeight: '700', transition: 'color 0.3s ease' }}>
          Why Detection Matters
        </p>
        <h2 style={{ fontSize: '2rem', fontWeight: '900', color: theme.text, letterSpacing: '2px', textTransform: 'uppercase', margin: 0, transition: 'color 0.3s ease' }}>
          The Deepfake Threat Is <span style={{ color: theme.primary, transition: 'color 0.3s ease' }}>Real</span>
        </h2>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '2.5rem 3rem', display: 'grid', gridTemplateColumns: '1fr 160px', gap: '2.5rem', alignItems: 'center', opacity: fading ? 0 : 1, transform: fading ? `translateX(${dir === 'right' ? '-20px' : '20px'})` : 'translateX(0)', transition: 'opacity 0.3s ease, transform 0.3s ease', boxSizing: 'border-box', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>

        <div>
          <span style={{ display: 'inline-block', backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: theme.primary, fontSize: '0.6rem', letterSpacing: '3px', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '4px', marginBottom: '1.1rem', fontWeight: '700', transition: 'color 0.3s ease' }}>
            {post.tag}
          </span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: theme.text, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 0.85rem 0', lineHeight: 1.3, transition: 'color 0.3s ease' }}>{post.title}</h3>
          <p style={{ color: theme.muted, fontSize: '0.9rem', lineHeight: 1.75, margin: 0, transition: 'color 0.3s ease' }}>{post.body}</p>
        </div>

        <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: '2.5rem', textAlign: 'center', transition: 'border-color 0.3s ease' }}>
          <div style={{ fontSize: '2.6rem', fontWeight: '900', color: theme.primary, letterSpacing: '-1px', lineHeight: 1, marginBottom: '0.5rem', transition: 'color 0.3s ease' }}>{post.stat}</div>
          <div style={{ color: theme.muted, fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 1.6, fontWeight: '700', transition: 'color 0.3s ease' }}>{post.statLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginTop: '2rem' }}>
        <button onClick={prev} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s, color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.color = theme.primary }} onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.muted }}>←</button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {posts.map((_, i) => <button key={i} onClick={() => goTo(i, i > active ? 'right' : 'left')} style={{ width: i === active ? '22px' : '5px', height: '5px', borderRadius: '3px', background: i === active ? theme.primary : theme.border, border: 'none', cursor: 'pointer', padding: 0, transition: 'width 0.3s ease, background 0.3s ease' }} />)}
        </div>
        <button onClick={next} style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s, color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.color = theme.primary }} onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.muted }}>→</button>
      </div>
    </section>
  )
}