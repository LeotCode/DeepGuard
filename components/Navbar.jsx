'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

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
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '1.72rem', fontWeight: '900', color: '#12306b' }}>
          Deep<span style={{ color: '#2454b8' }}>Guard</span>
        </span>
      </Link>

      <div style={{ display: 'flex', gap: '2.3rem', alignItems: 'center' }}>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} style={{
            textDecoration: 'none',
            color: pathname === link.href ? '#12306b' : '#64748b',
            fontSize: '1.02rem',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            borderBottom: pathname === link.href ? '2px solid #12306b' : '2px solid transparent',
            paddingBottom: '5px',
            transition: 'color 0.2s',
            fontFamily: "'Jost', sans-serif",
          }}>
            {link.label}
          </Link>
        ))}

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
      </div>
    </nav>
  )
}
