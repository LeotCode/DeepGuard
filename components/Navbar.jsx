'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import { useState, useEffect } from 'react'
import { auth } from '../lib/firebase'
import { logout } from '../lib/auth'
import { onAuthStateChanged } from 'firebase/auth'

export default function Navbar() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return unsubscribe
  }, [])

  const navLinks = [
    { label: 'Scan', href: '/' },
    { label: 'Game', href: '/game' },
    { label: 'Results', href: '/results' },
    { label: 'Settings', href: '/settings' },
  ]

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 3rem',
      height: '82px',
      backgroundColor: theme.cardBg,
      borderBottom: `1px solid ${theme.border}`,
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      boxShadow: theme.boxShadow,
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '1.72rem', fontWeight: '900', color: theme.primary }}>
          Deep<span style={{ color: theme.primary }}>Guard</span>
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '2.3rem', alignItems: 'center' }}>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} style={{
            textDecoration: 'none',
            color: pathname === link.href ? theme.primary : theme.muted,
            fontSize: '1.02rem',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            borderBottom: pathname === link.href ? `2px solid ${theme.primary}` : '2px solid transparent',
            paddingBottom: '5px',
            transition: 'color 0.2s',
            fontFamily: "'Jost', sans-serif",
          }}>
            {link.label}
          </Link>
        ))}

        {user ? (
          <button
            onClick={logout}
            style={{
              background: 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '0.68rem 1.65rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.98rem',
              fontWeight: '700',
              fontFamily: "'Jost', sans-serif",
              transition: 'background 0.2s',
              boxShadow: '0 10px 20px rgba(15, 37, 87, 0.18)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'}
            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'}
          >
            Logout
          </button>
        ) : (
          <Link href="/auth" style={{ textDecoration: 'none' }}>
            <button style={{
              background: 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '0.68rem 1.65rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.98rem',
              fontWeight: '700',
              fontFamily: "'Jost', sans-serif",
              transition: 'background 0.2s',
              boxShadow: '0 10px 20px rgba(15, 37, 87, 0.18)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #163d86 0%, #2454b8 100%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0f2557 0%, #163d86 52%, #2454b8 100%)'}
            >
              Login
            </button>
          </Link>
        )}
      </div>
    </nav>
  )
}
