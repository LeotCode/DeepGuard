'use client'
import Navbar from '@/components/Navbar'
import DarkModeToggle from '@/components/DarkModeToggle'
import { ResultsProvider } from '@/context/ResultsContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'

function AppContent({ children }) {
  const { theme } = useTheme()

  return (
    <body suppressHydrationWarning style={{
      margin: 0,
      background: theme.bg,
      color: theme.text,
      fontFamily: "'Jost', sans-serif",
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      <ResultsProvider>
        <Navbar />
        <main style={{ paddingTop: '72px', flex: 1 }}>
          {children}
        </main>
        <DarkModeToggle />
      </ResultsProvider>
    </body>
  )
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
        `}</style>
      </head>
      <ThemeProvider>
        <AppContent>{children}</AppContent>
      </ThemeProvider>
    </html>
  )
}