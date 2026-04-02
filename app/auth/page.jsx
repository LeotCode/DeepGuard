'use client'
import { useState } from 'react'

const NAVY   = '#1e3a8a'
const BLUE   = '#2563eb'
const TEXT   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const BG     = '#f4f6fb'
const FONT   = "'Jost', sans-serif"

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [focused, setFocused] = useState('')

  const inputStyle = (name) => ({
    width: '100%',
    padding: '0.85rem 1rem',
    backgroundColor: '#ffffff',
    border: `1.5px solid ${focused === name ? NAVY : BORDER}`,
    borderRadius: '10px',
    color: TEXT,
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: FONT,
    transition: 'border-color 0.2s',
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: FONT, fontSize: '1.8rem', fontWeight: '900', color: NAVY }}>
            Deep<span style={{ color: BLUE }}>Guard</span>
          </span>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '2.5rem', boxShadow: '0 4px 24px rgba(30,58,138,0.08)' }}>

          {/* Header */}
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: TEXT, textAlign: 'center', margin: '0 0 0.4rem', fontFamily: FONT }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p style={{ color: MUTED, textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem', fontFamily: FONT }}>
            {isLogin ? 'Sign in to your DeepGuard account' : 'Join DeepGuard today'}
          </p>

          {/* Tab switcher */}
          <div style={{ display: 'flex', backgroundColor: BG, borderRadius: '10px', padding: '4px', marginBottom: '1.75rem', border: `1px solid ${BORDER}` }}>
            {['Sign In', 'Sign Up'].map((label, i) => {
              const active = isLogin ? i === 0 : i === 1
              return (
                <button key={label} onClick={() => setIsLogin(i === 0)} style={{ flex: 1, padding: '0.6rem', backgroundColor: active ? '#ffffff' : 'transparent', color: active ? NAVY : MUTED, border: active ? `1px solid ${BORDER}` : 'none', borderRadius: '8px', fontFamily: FONT, fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: active ? '0 1px 4px rgba(30,58,138,0.08)' : 'none' }}>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: TEXT, marginBottom: '0.4rem', fontFamily: FONT }}>Username</label>
                <input type="text" placeholder="Your username" style={inputStyle('username')} onFocus={() => setFocused('username')} onBlur={() => setFocused('')} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: TEXT, marginBottom: '0.4rem', fontFamily: FONT }}>Email</label>
              <input type="email" placeholder="you@example.com" style={inputStyle('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused('')} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: TEXT, marginBottom: '0.4rem', fontFamily: FONT }}>Password</label>
              <input type="password" placeholder="••••••••" style={inputStyle('password')} onFocus={() => setFocused('password')} onBlur={() => setFocused('')} />
            </div>

            {isLogin && (
              <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
                <span style={{ fontSize: '0.82rem', color: BLUE, cursor: 'pointer', fontWeight: '600', fontFamily: FONT }}>Forgot password?</span>
              </div>
            )}

            <button
              style={{ width: '100%', padding: '0.95rem', backgroundColor: NAVY, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, marginTop: '0.5rem', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = BLUE}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = NAVY}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </div>

          {/* Toggle */}
          <p style={{ textAlign: 'center', color: MUTED, fontSize: '0.88rem', marginTop: '1.5rem', fontFamily: FONT }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span onClick={() => setIsLogin(!isLogin)} style={{ color: NAVY, cursor: 'pointer', fontWeight: '700' }}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}