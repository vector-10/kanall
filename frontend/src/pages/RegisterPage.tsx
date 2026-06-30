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

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.1em',
}

type Step = 'form' | 'otp' | 'done'

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

export default function RegisterPage({ onRegister }: Props) {
  const [step, setStep]         = useState<Step>('form')
  const [tenantId, setTenantId] = useState('')
  const [apiKey, setApiKey]     = useState('')
  const [copied, setCopied]     = useState(false)

  // Form state
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [clientError, setClientError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  // OTP state
  const [otp, setOtp] = useState('')

  // Step 1 — register; explicit generic pins TData so TS doesn't guess
  const registerMutation = useMutation<{ tenantId: string }, Error>({
    mutationFn: () => api.register(name, email, password),
    onSuccess: (data) => {
      setTenantId(data.tenantId)
      setStep('otp')
    },
  })

  // Step 2 — verify OTP; explicit generic pins TData to { apiKey: string }
  const verifyMutation = useMutation<{ apiKey: string }, Error>({
    mutationFn: () => api.verifyEmail(tenantId, otp),
    onSuccess: (data) => {
      setApiKey(data.apiKey)
      setStep('done')
      // Session cookie is now set — notify App so the route guard flips
      onRegister()
    },
  })

  const validate = (): boolean => {
    if (password.length < 8) { setClientError('Password must be at least 8 characters'); return false }
    if (password !== confirm) { setClientError('Passwords do not match'); return false }
    return true
  }

  const submitRegister = () => {
    setClientError('')
    if (validate()) registerMutation.mutate()
  }

  const copy = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayError = clientError || registerMutation.error?.message || verifyMutation.error?.message

  // ── STEP: DONE — show API key once ──────────────────────────────────────
  if (step === 'done') {
    return (
      <AuthShell tip={TIP}>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
              ACCOUNT VERIFIED
            </span>
          </div>

          <div>
            <div className="mb-1 text-[#444444]" style={LABEL}>API KEY — COPY NOW</div>
            <p className="text-[#555555] text-xs leading-relaxed mb-3">
              Store this in your server's <span style={{ fontFamily: 'var(--font-mono)' }}>.env</span>.
              It won't be shown again — you can always copy it from your dashboard settings.
            </p>
            <div
              className="bg-[#0A0A0A] border border-[#282828] px-4 py-3 text-sm text-[#FFCD32] break-all select-all leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {apiKey}
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
      </AuthShell>
    )
  }

  // ── STEP: OTP ────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <AuthShell tip={TIP}>
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-[#F5F5F5] mb-1">Check your email</h1>
          <p className="text-[#444444] text-sm">
            We sent a 6-digit code to <span className="text-[#888888]">{email}</span>.
            Enter it below to activate your account.
          </p>
        </div>

        <form onSubmit={e => { e.preventDefault(); verifyMutation.mutate() }} className="space-y-4">
          <div>
            <label className="block mb-2 text-[#5E5E5E]" style={LABEL}>VERIFICATION CODE</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              autoFocus
              className={INPUT_CLASS}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', fontSize: '20px' }}
            />
          </div>

          {verifyMutation.error && (
            <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
              {verifyMutation.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || otp.length !== 6}
            className="w-full bg-[#FFCD32] text-[#0D0D0D] py-3.5 text-sm font-semibold tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {verifyMutation.isPending ? 'VERIFYING...' : 'VERIFY →'}
          </button>
        </form>

        <p className="text-center text-[#444444] text-xs mt-6">
          Didn't receive it?{' '}
          <button
            onClick={() => { setStep('form'); setOtp('') }}
            className="text-[#FFCD32] hover:opacity-75 transition-opacity bg-transparent border-none p-0 cursor-pointer"
          >
            Go back
          </button>
        </p>
      </AuthShell>
    )
  }

  // ── STEP: FORM ───────────────────────────────────────────────────────────
  return (
    <AuthShell tip={TIP}>
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-[#F5F5F5] mb-1">Create account</h1>
        <p className="text-[#444444] text-sm">Register your organisation to get started.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); submitRegister() }} className="space-y-4">
        <div>
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL}>ORGANISATION NAME</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Acme Corp"
            required
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL}>EMAIL</label>
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
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL}>PASSWORD</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setClientError('') }}
              placeholder="At least 8 characters"
              required
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

        <div>
          <label className="block mb-2 text-[#5E5E5E]" style={LABEL}>CONFIRM PASSWORD</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setClientError('') }}
              placeholder="Repeat password"
              required
              className={`${INPUT_CLASS} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#F5F5F5] transition-colors bg-transparent border-none p-0 cursor-pointer"
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
        </div>

        {displayError && (
          <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            {displayError}
          </p>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full bg-[#FFCD32] text-[#0D0D0D] py-3.5 text-sm font-semibold tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {registerMutation.isPending ? 'REGISTERING...' : 'REGISTER →'}
        </button>
      </form>

      <p className="text-center text-[#444444] text-xs mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-[#FFCD32] hover:opacity-75 transition-opacity">
          Log in →
        </Link>
      </p>
    </AuthShell>
  )
}
