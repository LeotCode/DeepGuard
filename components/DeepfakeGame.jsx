'use client'
import { useState } from 'react'

const NAVY = '#12306b'
const TEXT = '#eff6ff'
const MUTED = '#cbd5e1'
const BORDER = 'rgba(148, 163, 184, 0.2)'
const FONT = "'Jost', sans-serif"
const DEEP_GRADIENT = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'
const DEEP_GRADIENT_HOVER = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'
const CARD_GRADIENT = 'radial-gradient(circle at top left, rgba(96, 165, 250, 0.22), transparent 30%), linear-gradient(145deg, #071a3d 0%, #0f2557 48%, #163d86 100%)'

const GAME_IMAGES = [
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/400px-Camponotus_flavomarginatus_ant.jpg',
    label: 'REAL',
    explanation: 'Correct answer: REAL. Natural texture and lighting are consistent across the frame.',
  },
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/400px-PNG_transparency_demonstration_1.png',
    label: 'FAKE',
    explanation: 'Correct answer: FAKE. The image shows synthetic compositing cues and unnatural edge blending.',
  },
  {
    src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    label: 'REAL',
    explanation: 'Correct answer: REAL. Facial geometry, skin texture, and shadows remain coherent.',
  },
]

export default function DeepfakeGame() {
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
    <div style={{ background: CARD_GRADIENT, borderRadius: '28px', border: `1px solid ${BORDER}`, boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)', padding: '2.4rem', maxWidth: '1100px', margin: '0 auto' }}>
      <p style={{ color: '#93c5fd', fontSize: '1.08rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 1rem', fontFamily: FONT }}>
        Deepfakes often decieve the naked eye
      </p>
      <h2 style={{ margin: '0 0 1.1rem', fontSize: '2.15rem', fontWeight: '900', color: TEXT, fontFamily: FONT }}>
        Can You Spot The Deepfake?
      </h2>
      <p style={{ color: MUTED, fontSize: '1.15rem', lineHeight: 1.8, margin: '0 0 1.75rem', maxWidth: '760px', fontFamily: FONT }}>
        Look at the image, decide whether it is real or fake, and see the answer instantly.
      </p>

      <div style={{ borderRadius: '24px', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(226, 232, 240, 0.9) 0%, rgba(248, 250, 252, 0.92) 100%)', border: '1px solid rgba(255, 255, 255, 0.18)', width: '100%', maxWidth: '460px', aspectRatio: '1 / 1', margin: '0 auto 1.25rem' }}>
        <img
          src={currentGameImage.src}
          alt="Real or fake challenge"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.2rem' }}>
        <button
          onClick={() => handleGuess('REAL')}
          style={{ flex: 1, padding: '1.15rem 1.3rem', background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', color: '#ecfeff', border: '1px solid rgba(153, 246, 228, 0.25)', borderRadius: '14px', fontSize: '1.15rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 24px rgba(15, 118, 110, 0.28)' }}
        >
          REAL
        </button>
        <button
          onClick={() => handleGuess('FAKE')}
          style={{ flex: 1, padding: '1.15rem 1.3rem', background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', color: '#fff1f2', border: '1px solid rgba(254, 202, 202, 0.22)', borderRadius: '14px', fontSize: '1.15rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 14px 24px rgba(127, 29, 29, 0.3)' }}
        >
          FAKE
        </button>
      </div>

      {gameResult && (
        <div style={{ backgroundColor: gameResult.background, color: gameResult.tone, border: `1px solid ${gameResult.border}`, borderRadius: '16px', padding: '1.15rem 1.25rem', marginBottom: '1.2rem' }}>
          <p style={{ margin: '0 0 0.45rem', fontSize: '1.12rem', fontWeight: '800', fontFamily: FONT }}>{gameResult.message}</p>
          <p style={{ margin: 0, fontSize: '1.08rem', lineHeight: 1.7, fontFamily: FONT }}>{gameResult.explanation}</p>
        </div>
      )}

      <button onClick={handleNextRound} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: DEEP_GRADIENT, color: '#fff', border: 'none', borderRadius: '12px', padding: '1rem 1.6rem', fontSize: '1.08rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', boxShadow: '0 14px 28px rgba(15, 37, 87, 0.16)' }} onMouseEnter={e => e.currentTarget.style.background = DEEP_GRADIENT_HOVER} onMouseLeave={e => e.currentTarget.style.background = DEEP_GRADIENT}>
        Next Image
      </button>
    </div>
  )
}
