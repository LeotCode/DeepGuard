'use client'
import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

const FONT = "'Jost', sans-serif"
const DEEP_GRADIENT = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'
const DEEP_GRADIENT_HOVER = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'

const GAME_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    label: 'REAL',
    explanation: 'Correct answer: REAL. Natural texture and lighting are consistent across the frame.',
  },
  { 
    src: 'https://thispersonnotexist.org/downloadimage/Ac3RhdGljL21hbi9zZWVkMTUxNzMuanBlZw==',
    label: 'FAKE',
    explanation: 'Correct answer: FAKE. Skin texture looks overly smooth and uniform in some areas.',
  },
  {
    src: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    label: 'REAL',
    explanation: 'Correct answer: REAL. Lighting is natural and reflections are accurate.',
  },
]

export default function DeepfakeGame() {
  const { theme } = useTheme()
  const [gameIndex, setGameIndex] = useState(0)
  const [gameResult, setGameResult] = useState(null)
  const currentGameImage = GAME_IMAGES[gameIndex]

  const handleGuess = (guess) => {
    const isCorrect = guess === currentGameImage.label
    setGameResult({
      tone: isCorrect ? '#166534' : '#991b1b',
      background: isCorrect ? '#dcfce7' : '#fee2e2',
      border: isCorrect ? '#86efac' : '#fca5a5',
      message: isCorrect ? `Correct. This image is ${currentGameImage.label}.` : `Not quite. This image is ${currentGameImage.label}.`,
      explanation: currentGameImage.explanation,
    })
  }

  const handleNextRound = () => {
    setGameResult(null)
    setGameIndex((current) => (current + 1) % GAME_IMAGES.length)
  }

  return (
    <div style={{
      background: theme.cardBg,
      borderRadius: '28px',
      border: `1px solid ${theme.border}`,
      boxShadow: theme.boxShadow,
      padding: '0.8rem',
      maxWidth: '700px',
      margin: '0 auto',
      transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
    }}>
      <p style={{ color: theme.primary, fontSize: '1.08rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 1rem', fontFamily: FONT }}>
        Deepfakes often deceive the naked eye
      </p>
      <h2 style={{ margin: '0 0 1.1rem', fontSize: '1.4rem', fontWeight: '900', color: theme.text, fontFamily: FONT }}>
        Can You Spot The Deepfake?
      </h2>
      <p style={{ color: theme.muted, fontSize: '0.85rem', lineHeight: 1.8, margin: '0 0 1.75rem', maxWidth: '760px', fontFamily: FONT }}>
        Look at the image, decide whether it is real or fake, and see the answer instantly.
      </p>

      <div style={{
        borderRadius: '24px',
        overflow: 'hidden',
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        width: '100%',
        maxWidth: '250px',
        aspectRatio: '1 / 1',
        margin: '0 auto 1.25rem'
      }}>
        <img
          src={currentGameImage.src}
          alt="Real or fake challenge"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.2rem' }}>
        <button
          onClick={() => handleGuess('REAL')}
          style={{ flex: 1, padding: '0.8rem 0.9rem', background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', color: '#ecfeff', border: '1px solid rgba(153, 246, 228, 0.25)', borderRadius: '14px', fontSize: '1.15rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 24px rgba(15, 118, 110, 0.28)' }}
        >
          REAL
        </button>
        <button
          onClick={() => handleGuess('FAKE')}
          style={{ flex: 1, padding: '0.8rem 0.9rem', background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', color: '#fff1f2', border: '1px solid rgba(254, 202, 202, 0.22)', borderRadius: '14px', fontSize: '1.15rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 24px rgba(127, 29, 29, 0.3)' }}
        >
          FAKE
        </button>
      </div>

      {gameResult && (
        <div style={{ backgroundColor: gameResult.background, color: gameResult.tone, border: `1px solid ${gameResult.border}`, borderRadius: '16px', padding: '0.8rem 0.9rem', marginBottom: '1.2rem' }}>
          <p style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', fontWeight: '800', fontFamily: FONT }}>{gameResult.message}</p>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7, fontFamily: FONT }}>{gameResult.explanation}</p>
        </div>
      )}

      <button onClick={handleNextRound} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.2rem', fontSize: '1.08rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', boxShadow: '0 14px 28px rgba(15, 37, 87, 0.16)' }} onMouseEnter={e => e.currentTarget.style.background = DEEP_GRADIENT_HOVER} onMouseLeave={e => e.currentTarget.style.background = DEEP_GRADIENT}>
        Next Image
      </button>
    </div>
  )
}
