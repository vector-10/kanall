import { NavLink, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Tenant } from '../api'
import ThemeToggle from './ThemeToggle'

interface Props {
  children: React.ReactNode
  onLogout: () => void
}

const NAV = [
  { to: '/accounts',     label: 'ACCOUNTS' },
  { to: '/customers',    label: 'CUSTOMERS' },
  { to: '/dead-letters', label: 'MONITORING' },
  { to: '/settings',     label: 'SETTINGS' },
]

const MONO = { fontFamily: 'var(--font-mono)' }

export default function Layout({ children, onLogout }: Props) {
  const { data: me } = useQuery<Tenant>({
    queryKey: ['me'],
    queryFn: api.auth.me,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const { data: healthy } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border)' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span style={{
              fontFamily: "'Bungee Inline', sans-serif",
              fontSize: 18,
              letterSpacing: '0.06em',
              color: 'var(--text)',
            }}>
              KANALL
            </span>
          </Link>
          <div style={{ width: 28, height: 2, background: 'var(--accent)', marginTop: 8 }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block' }}>
              {({ isActive }) => (
                <div style={{
                  padding: '9px 20px',
                  borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'rgba(255,205,50,0.07)' : 'transparent',
                  cursor: 'pointer',
                }}>
                  <span style={{
                    ...MONO,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid var(--border)' }}>

          {/* Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: healthy === undefined ? 'var(--border)' : healthy ? 'var(--green)' : 'var(--red)',
            }} />
            <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-faint)' }}>
              {healthy === undefined ? 'CHECKING' : healthy ? 'API ONLINE' : 'API OFFLINE'}
            </span>
          </div>

          {/* Tenant */}
          {me && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 2 }}>
                TENANT
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={me.name}>
                {me.name}
              </div>
            </div>
          )}

          {/* Theme toggle + Logout row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onLogout}
              style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-faint)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}
            >
              LOG OUT
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
