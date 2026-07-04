import { useState, useEffect } from 'react'

export default function ThemeToggle({ position = 'inline' }: { position?: 'inline' | 'fixed-tr' }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('kanall-theme') as 'light' | 'dark' | null
    const initial = stored ?? 'light'
    document.documentElement.setAttribute('data-theme', initial)
    return initial
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('kanall-theme', theme)
  }, [theme])

  const style: React.CSSProperties = position === 'fixed-tr'
    ? { position: 'fixed', top: 16, right: 20, zIndex: 100 }
    : {}

  return (
    <button
      onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        ...style,
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        padding: '4px 9px',
        lineHeight: 1.4,
        color: 'var(--text-muted)',
        borderRadius: 0,
      }}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
