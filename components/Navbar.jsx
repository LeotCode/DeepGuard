'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const navLinks = [
    { label: 'Scan', href: '/' },
    { label: 'Results', href: '/results' },
    { label: 'Settings', href: '/settings' },
  ]

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2.5rem',
      height: '72px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '1.5rem', fontWeight: '900', color: '#1e3a8a' }}>
          Deep<span style={{ color: '#2563eb' }}>Guard</span>
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} style={{
            textDecoration: 'none',
            color: pathname === link.href ? '#1e3a8a' : '#64748b',
            fontSize: '0.95rem',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            borderBottom: pathname === link.href ? '2px solid #1e3a8a' : '2px solid transparent',
            paddingBottom: '4px',
            transition: 'color 0.2s',
            fontFamily: "'Jost', sans-serif",
          }}>
            {link.label}
          </Link>
        ))}

        <Link href="/auth" style={{ textDecoration: 'none' }}>
          <button style={{
            backgroundColor: '#1e3a8a',
            border: 'none',
            color: '#ffffff',
            padding: '0.5rem 1.4rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '700',
            fontFamily: "'Jost', sans-serif",
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e40af'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1e3a8a'}
          >
            Login
          </button>
        </Link>
      </div>
    </nav>
  )
}