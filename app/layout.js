import Navbar from '@/components/Navbar'
import ScrollingBar from '@/components/ScrollingBar'
import { ResultsProvider } from '@/context/ResultsContext'

export const metadata = {
  title: 'DeepGuard',
  description: 'AI-powered deepfake detection',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #f4f6fb; }
        `}</style>
      </head>
      <body style={{
        margin: 0,
        background: '#f4f6fb',
        color: '#0f172a',
        fontFamily: "'Jost', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <ResultsProvider>
          <Navbar />
          <main style={{ paddingTop: '72px', flex: 1 }}>
            {children}
          </main>
          <ScrollingBar />
        </ResultsProvider>
      </body>
    </html>
  )
}