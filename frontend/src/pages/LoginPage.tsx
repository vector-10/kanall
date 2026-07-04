import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import AuthShell from '../components/AuthShell'

interface Props {
  onLogin: () => void
}

const TIP = 'One set of credentials. Your dashboard, your accounts, your ledger — all secured with a proper session.'

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.1em',
  display: 'block',
  marginBottom: '8px',
  color: 'var(--text-muted)',
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.auth.login(email, password),
    onSuccess: onLogin,
  })

  return (
    <AuthShell tip={TIP}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sign in to your Kanall dashboard.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); mutate() }} className="space-y-4">
        <div>
          <label style={LABEL}>EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="auth-input"
          />
        </div>

        <div>
          <label style={LABEL}>PASSWORD</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="auth-input"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full"
          style={{ fontFamily: 'var(--font-mono)', background: '#FFCD32', color: '#0D0D0D', padding: '14px', fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', border: 'none', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
        >
          {isPending ? 'SIGNING IN...' : 'SIGN IN →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
        New here?{' '}
        <Link to="/register" style={{ color: '#FFCD32', textDecoration: 'none' }}>
          Register →
        </Link>
      </p>
    </AuthShell>
  )
}
