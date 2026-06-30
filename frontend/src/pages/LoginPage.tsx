import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import AuthShell from '../components/AuthShell'

interface Props {
  onLogin: () => void
}

const TIP = 'One set of credentials. Your dashboard, your accounts, your ledger — all secured with a proper session.'

const INPUT_CLASS =
  'w-full bg-[#111111] border border-[#282828] px-4 py-3 text-sm text-[#F5F5F5] placeholder-[#333333] focus:outline-none focus:border-[#FFCD32] transition-colors'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.1em',
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
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-[#F5F5F5] mb-1">Welcome back</h1>
        <p className="text-[#444444] text-sm">Sign in to your Kanall dashboard.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); mutate() }} className="space-y-4">
        <div>
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL_STYLE}>
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL_STYLE}>
            PASSWORD
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className={`${INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#F5F5F5] transition-colors bg-transparent border-none p-0 cursor-pointer"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#FFCD32] text-[#0D0D0D] py-3.5 text-sm font-semibold tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {isPending ? 'SIGNING IN...' : 'SIGN IN →'}
        </button>
      </form>

      <p className="text-center text-[#444444] text-xs mt-6">
        New here?{' '}
        <Link to="/register" className="text-[#FFCD32] hover:opacity-75 transition-opacity">
          Register →
        </Link>
      </p>
    </AuthShell>
  )
}
