'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import { loginWithGoogle, loginWithFacebook, loginWithEmail, registerWithEmail, sendPasswordReset } from '../../auth.js'
import { updateProfile } from 'firebase/auth'

const FONT = "'Jost', sans-serif"

export default function Auth() {
  const { theme } = useTheme()
  const [mode, setMode] = useState('login')
  const [focused, setFocused] = useState('')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatusMessage('')
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password)
        router.push('/')
      } else if (mode === 'signup') {
        const userCredential = await registerWithEmail(email, password)
        await updateProfile(userCredential.user, { displayName: username })
        router.push('/')
      } else if (mode === 'forgot') {
        await sendPasswordReset(email)
        setStatusMessage('A password reset link has been sent to your email.')
      }
    } catch (err) {
      console.log('Error code:', err.code) // For debugging
      let customMessage = 'An error occurred. Please try again.'
      if (err.code === 'auth/invalid-credential') {
        customMessage = 'Invalid email or password. Please check and try again.'
      } else if (err.code === 'auth/user-not-found') {
        customMessage = mode === 'forgot'
          ? 'No account was found with that email address.'
          : 'No account found with this email. Please sign up first.'
      } else if (err.code === 'auth/wrong-password') {
        customMessage = 'Incorrect password. Please try again.'
      } else if (err.code === 'auth/email-already-in-use') {
        customMessage = 'An account with this email already exists. Please sign in instead.'
      } else if (err.code === 'auth/weak-password') {
        customMessage = 'Password is too weak. Please choose a stronger password.'
      } else if (err.code === 'auth/invalid-email') {
        customMessage = 'Invalid email address. Please check and try again.'
      } else if (err.code === 'auth/missing-password') {
        customMessage = 'Please enter a password.'
      }
      setError(customMessage)
    }
  }

  const handleOAuth = async (loginFunc) => {
    setError('')
    try {
      await loginFunc()
      router.push('/')
    } catch (err) {
      let customMessage = 'An error occurred during sign-in. Please try again.'
      if (err.code === 'auth/popup-closed-by-user') {
        customMessage = 'Sign-in was cancelled. Please try again.'
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        customMessage = 'An account with this email already exists with a different sign-in method.'
      }
      setError(customMessage)
    }
  }

  const getTabLabels = () => ['Sign In', 'Sign Up']
  const getActiveIndex = () => {
    if (mode === 'login') return 0
    if (mode === 'signup') return 1
    return -1 // for forgot, no active tab
  }

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
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
          {mode === 'forgot' && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.9rem', color: theme.primary, cursor: 'pointer', fontWeight: '600', fontFamily: FONT }} onClick={() => setMode('login')}>← Back to Sign In</span>
            </div>
          )}
          <p style={{ color: theme.muted, textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem', fontFamily: FONT }}>
            {mode === 'login' ? 'Sign in to your DeepGuard account' : mode === 'signup' ? 'Join DeepGuard today' : 'Enter your email to reset your password'}
          </p>

          {/* Tab switcher */}
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', backgroundColor: theme.bg, borderRadius: '10px', padding: '4px', marginBottom: '1.75rem', border: `1px solid ${theme.border}` }}>
              {getTabLabels().map((label, i) => {
                const active = i === getActiveIndex()
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (i === 0) setMode('login')
                      else setMode('signup')
                    }}
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
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Username</label>
                <input type="text" placeholder="Your username" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle('username')} onFocus={() => setFocused('username')} onBlur={() => setFocused('')} />
              </div>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Email</label>
                <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused('')} />
              </div>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: theme.text, marginBottom: '0.4rem', fontFamily: FONT }}>Password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle('password')} onFocus={() => setFocused('password')} onBlur={() => setFocused('')} />
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
                <span style={{ fontSize: '0.82rem', color: theme.primary, cursor: 'pointer', fontWeight: '600', fontFamily: FONT }} onClick={() => setMode('forgot')}>Forgot password?</span>
              </div>
            )}

            {error && (
              <div style={{ color: 'red', textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}
            {statusMessage && (
              <div style={{ color: '#22c55e', textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                {statusMessage}
              </div>
            )}

            <button
              type="submit"
              style={{ width: '100%', padding: '0.95rem', backgroundColor: theme.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, marginTop: '0.5rem', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.primary}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.primary}
            >
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </button>

            {(mode === 'login' || mode === 'signup') && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleOAuth(loginWithGoogle)}
                  style={{ width: '100%', padding: '0.95rem', backgroundColor: '#8e1e02', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img src='/images/Google_Logo.png' alt='Google Logo' style={{ width: '20px', height: '20px', marginRight: '0.5rem', marginTop: '2px' }} />
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth(loginWithFacebook)}
                  style={{ width: '100%', padding: '0.95rem', backgroundColor: '#073d83', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img src='/images/Facebook_Logo.png' alt='Facebook Logo' style={{ width: '20px', height: '20px', marginRight: '0.5rem', marginTop: '2px' }} />
                  Continue with Facebook
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}