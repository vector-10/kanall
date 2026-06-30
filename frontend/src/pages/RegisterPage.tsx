import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import AuthShell from '../components/AuthShell'

interface Props {
  onRegister: () => void
}

const TIP = 'Provision real NUBANs. Record every payment in a double-entry ledger. Deliver events to your endpoint — all from one API key.'

const INPUT_CLASS =
  'w-full bg-[#111111] border border-[#282828] px-4 py-3 text-sm text-[#F5F5F5] placeholder-[#333333] focus:outline-none focus:border-[#FFCD32] transition-colors'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.1em',
}

export default function RegisterPage({ onRegister }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [clientError, setClientError] = useState('')
  const [copied, setCopied] = useState(false)

  const { mutate, isPending, error: serverError, data } = useMutation({
    mutationFn: () => api.register(name, email, password),
  })

  const validate = (): boolean => {
    if (password.length < 8) {
      setClientError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirm) {
      setClientError('Passwords do not match')
      return false
    }
    return true
  }

  const submit = () => {
    setClientError('')
    if (validate()) mutate()
  }

  const copy = () => {
    if (!data) return
    navigator.clipboard.writeText(data.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayError = clientError || serverError?.message

  return (
    <AuthShell tip={TIP}>
      {data ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span
              className="text-green-400 text-xs"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
            >
              TENANT REGISTERED
            </span>
          </div>

          <div>
            <div
              className="mb-1 text-[#444444]"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em' }}
            >
              API KEY — SHOWN ONCE
            </div>
            <p className="text-[#555555] text-xs leading-relaxed mb-3">
              Store this in your backend <span style={{ fontFamily: 'var(--font-mono)' }}>.env</span>. It authenticates your server's API calls and will never be shown again.
            </p>
            <div
              className="bg-[#0A0A0A] border border-[#282828] px-4 py-3 text-sm text-[#FFCD32] break-all select-all leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {data.apiKey}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={copy}
              className="flex-1 border border-[#282828] text-[#888888] hover:border-[#444444] hover:text-[#F5F5F5] py-3 text-xs tracking-widest transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {copied ? 'COPIED ✓' : 'COPY KEY'}
            </button>
            <button
              onClick={onRegister}
              className="flex-1 bg-[#FFCD32] text-[#0D0D0D] py-3 text-xs font-semibold tracking-widest hover:opacity-90 transition-opacity"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              DASHBOARD →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-[#F5F5F5] mb-1">Create account</h1>
            <p className="text-[#444444] text-sm">Register your organisation to get started.</p>
          </div>

          <form onSubmit={e => { e.preventDefault(); submit() }} className="space-y-4">
            <div>
              <label className="block mb-2 text-[#555555]" style={LABEL_STYLE}>
                ORGANISATION NAME
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Acme Corp"
                required
                className={INPUT_CLASS}
              />
            </div>

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
                onChange={e => { setPassword(e.target.value); setClientError('') }}
                placeholder="At least 8 characters"
                required
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block mb-2 text-[#555555]" style={LABEL_STYLE}>
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setClientError('') }}
                placeholder="Repeat password"
                required
                className={INPUT_CLASS}
              />
            </div>

            {displayError && (
              <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#FFCD32] text-[#0D0D0D] py-3.5 text-sm font-semibold tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {isPending ? 'REGISTERING...' : 'REGISTER →'}
            </button>
          </form>

          <p className="text-center text-[#444444] text-xs mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#FFCD32] hover:opacity-75 transition-opacity">
              Log in →
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
