import { NavLink, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Tenant } from '../api'

interface Props {
  children: React.ReactNode
  onLogout: () => void
}

const NAV = [
  { to: '/accounts', label: 'ACCOUNTS' },
  { to: '/dead-letters', label: 'DEAD LETTERS' },
]

export default function Layout({ children, onLogout }: Props) {
  // Reads from the cache populated by App — no extra network request
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
    <div className="flex h-screen" style={{ background: '#0A0A0A', fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col"
        style={{ width: 220, background: '#0A0A0A', borderRight: '1px solid #1A1A1A' }}
      >

        {/* Logo */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid #1A1A1A' }}>
          <Link to="/" className="inline-block">
            <span
              style={{
                fontFamily: "'Bungee Inline', sans-serif",
                fontSize: 18,
                letterSpacing: '0.06em',
                color: '#F5F5F5',
              }}
            >
              KANALL
            </span>
          </Link>
          <div style={{ width: 28, height: 2, background: '#FFCD32', marginTop: 8 }} />
        </div>

        {/* Nav */}
        <nav className="flex-1" style={{ padding: '10px 0' }}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <div
                  style={{
                    padding: '9px 20px',
                    borderLeft: `2px solid ${isActive ? '#FFCD32' : 'transparent'}`,
                    background: isActive ? 'rgba(255,205,50,0.05)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      color: isActive ? '#FFCD32' : '#3A3A3A',
                    }}
                  >
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #1A1A1A' }}>

          {/* Health indicator */}
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                flexShrink: 0,
                background:
                  healthy === undefined ? '#2A2A2A' : healthy ? '#22c55e' : '#ef4444',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                color: '#2A2A2A',
              }}
            >
              {healthy === undefined ? 'CHECKING' : healthy ? 'API ONLINE' : 'API OFFLINE'}
            </span>
          </div>

          {/* Tenant name */}
          {me && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  color: '#2A2A2A',
                  marginBottom: 3,
                }}
              >
                TENANT
              </div>
              <div
                className="truncate"
                style={{ fontSize: 12, color: '#444444', fontFamily: 'var(--font-sans)' }}
                title={me.name}
              >
                {me.name}
              </div>
            </div>
          )}

          {/* Log out */}
          <button
            onClick={onLogout}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              color: '#2A2A2A',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            className="hover:text-[#FFCD32] transition-colors"
          >
            LOG OUT →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: '#0A0A0A' }}>
        {children}
      </main>
    </div>
  )
}
