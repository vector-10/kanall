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

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
          <label className="block mb-2 text-[#555555]" style={LABEL_STYLE}>
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
          <label className="block mb-2 text-[#555555]" style={LABEL_STYLE}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            required
            autoComplete="current-password"
            className={INPUT_CLASS}
          />
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
