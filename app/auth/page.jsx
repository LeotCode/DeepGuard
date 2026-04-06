'use client'
import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import { loginWithGoogle, loginWithFacebook } from '../../../auth.js'

const FONT = "'Jost', sans-serif"

export default function Auth() {
  const { theme } = useTheme()
  const [isLogin, setIsLogin] = useState(true)
  const [focused, setFocused] = useState('')

  const inputStyle = (name) => ({
    width: '100%',
    padding: '0.85rem 1rem',
    backgroundColor: theme.cardBg,
    border: `1.5px solid ${focused === name ? theme.primary : theme.border}`,
    borderRadius: '10px',
    color: theme.text,
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: FONT,
    transition: 'border-color 0.2s',
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: FONT, transition: 'background-color 0.3s ease, color 0.3s ease' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: FONT, fontSize: '1.8rem', fontWeight: '900', color: theme.primary }}>
            Deep<span style={{ color: theme.primary }}>Guard</span>
          </span>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '2.5rem', boxShadow: theme.boxShadow }}>

          {/* Header */}
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: theme.text, textAlign: 'center', margin: '0 0 0.4rem', fontFamily: FONT }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p style={{ color: theme.muted, textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem', fontFamily: FONT }}>
            {isLogin ? 'Sign in to your DeepGuard account' : 'Join DeepGuard today'}
          </p>

          {/* Tab switcher */}
          <div style={{ display: 'flex', backgroundColor: theme.bg, borderRadius: '10px', padding: '4px', marginBottom: '1.75rem', border: `1px solid ${theme.border}` }}>
            {['Sign In', 'Sign Up'].map((label, i) => {
              const active = isLogin ? i === 0 : i === 1
              return (
                <button
                  key={label}
                  onClick={() => setIsLogin(i === 0)}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    backgroundColor: active ? theme.cardBg : 'transparent',
                    color: active ? theme.primary : theme.muted,
                    border: active ? `1px solid ${theme.border}` : 'none',
                    borderRadius: '8px',
                    fontFamily: FONT,
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: active ? theme.boxShadow : 'none'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Username</label>
                <input type="text" placeholder="Your username" style={inputStyle('username')} onFocus={() => setFocused('username')} onBlur={() => setFocused('')} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Email</label>
              <input type="email" placeholder="you@example.com" style={inputStyle('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused('')} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Password</label>
              <input type="password" placeholder="••••••••" style={inputStyle('password')} onFocus={() => setFocused('password')} onBlur={() => setFocused('')} />
            </div>

            {isLogin && (
              <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
                <span style={{ fontSize: '0.82rem', color: theme.primary, cursor: 'pointer', fontWeight: '600', fontFamily: FONT }}>Forgot password?</span>
              </div>
            )}

            <button
              style={{ width: '100%', padding: '0.95rem', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, marginTop: '0.5rem', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.primary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.primary}
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={loginWithGoogle}
                style={{ width: '100%', padding: '0.95rem', backgroundColor: '#8e1e02', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img src='/images/Google_Logo.png' alt='Google Logo' style={{ width: '20px', height: '20px', marginRight: '0.5rem', marginTop: '2px' }} />
                Continue with Google
              </button>
              <button
                onClick={loginWithFacebook}
                style={{ width: '100%', padding: '0.95rem', backgroundColor: '#073d83', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img src='/images/Facebook_Logo.png' alt='Facebook Logo' style={{ width: '20px', height: '20px', marginRight: '0.5rem', marginTop: '2px' }} />
                Continue with Facebook
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}