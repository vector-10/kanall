import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import AuthShell from '../components/AuthShell'

interface Props {
  onRegister: () => void
}

const TIP = 'Provision real NUBANs. Record every payment in a double-entry ledger. Deliver events to your endpoint — all from one API key.'

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.1em',
  display: 'block',
  marginBottom: '8px',
  color: 'var(--text-muted)',
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

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [clientError, setClientError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [otp, setOtp] = useState('')

  const registerMutation = useMutation<{ tenantId: string }, Error>({
    mutationFn: () => api.register(name, email, password),
    onSuccess: (data) => { setTenantId(data.tenantId); setStep('otp') },
  })

  const verifyMutation = useMutation<{ apiKey: string }, Error>({
    mutationFn: () => api.verifyEmail(tenantId, otp),
    onSuccess: (data) => { setApiKey(data.apiKey); setStep('done') },
  })

  const validate = (): boolean => {
    if (password.length < 8) { setClientError('Password must be at least 8 characters'); return false }
    if (password !== confirm) { setClientError('Passwords do not match'); return false }
    return true
  }

  const submitRegister = () => { setClientError(''); if (validate()) registerMutation.mutate() }

  const copy = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayError = clientError || registerMutation.error?.message || verifyMutation.error?.message

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      tabIndex={-1}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <EyeIcon open={show} />
    </button>
  )

  // ── DONE ──
  if (step === 'done') {
    return (
      <AuthShell tip={TIP}>
        <div className="space-y-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#22c55e' }}>
              ACCOUNT VERIFIED
            </span>
          </div>

          <div>
            <div style={{ ...LABEL, marginBottom: 4 }}>API KEY — COPY NOW</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
              Store this in your server's <span style={{ fontFamily: 'var(--font-mono)' }}>.env</span>.
              It won't be shown again — you can always rotate it from Settings.
            </p>
            <div
              style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px 16px', fontSize: 13, color: '#FFCD32', wordBreak: 'break-all', userSelect: 'all', lineHeight: 1.6 }}
            >
              {apiKey}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={copy}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', padding: '12px', background: 'transparent', color: copied ? '#22c55e' : 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              {copied ? 'COPIED ✓' : 'COPY KEY'}
            </button>
            <button
              onClick={onRegister}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em', padding: '12px', background: '#FFCD32', color: '#0D0D0D', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              DASHBOARD →
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  // ── OTP ──
  if (step === 'otp') {
    return (
      <AuthShell tip={TIP}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Check your email</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            We sent a 6-digit code to <span style={{ color: 'var(--text)' }}>{email}</span>.
            Enter it below to activate your account.
          </p>
        </div>

        <form onSubmit={e => { e.preventDefault(); verifyMutation.mutate() }} className="space-y-4">
          <div>
            <label style={LABEL}>VERIFICATION CODE</label>
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
              className="auth-input"
              style={{ letterSpacing: '0.3em', fontSize: '20px' }}
            />
          </div>

          {verifyMutation.error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{verifyMutation.error.message}</p>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || otp.length !== 6}
            className="w-full"
            style={{ fontFamily: 'var(--font-mono)', background: '#FFCD32', color: '#0D0D0D', padding: '14px', fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', border: 'none', cursor: 'pointer', opacity: (verifyMutation.isPending || otp.length !== 6) ? 0.5 : 1 }}
          >
            {verifyMutation.isPending ? 'VERIFYING...' : 'VERIFY →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
          Didn't receive it?{' '}
          <button
            onClick={() => { setStep('form'); setOtp('') }}
            style={{ color: '#FFCD32', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
          >
            Go back
          </button>
        </p>
      </AuthShell>
    )
  }

  // ── FORM ──
  return (
    <AuthShell tip={TIP}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Create account</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Register your organisation to get started.</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); submitRegister() }} className="space-y-4">
        <div>
          <label style={LABEL}>ORGANISATION NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" required className="auth-input" />
        </div>

        <div>
          <label style={LABEL}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="auth-input" />
        </div>

        <div>
          <label style={LABEL}>PASSWORD</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setClientError('') }}
              placeholder="At least 8 characters"
              required
              className="auth-input"
              style={{ paddingRight: 44 }}
            />
            {eyeBtn(showPassword, () => setShowPassword(v => !v))}
          </div>
        </div>

        <div>
          <label style={LABEL}>CONFIRM PASSWORD</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setClientError('') }}
              placeholder="Repeat password"
              required
              className="auth-input"
              style={{ paddingRight: 44 }}
            />
            {eyeBtn(showConfirm, () => setShowConfirm(v => !v))}
          </div>
        </div>

        {displayError && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)' }}>{displayError}</p>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full"
          style={{ fontFamily: 'var(--font-mono)', background: '#FFCD32', color: '#0D0D0D', padding: '14px', fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', border: 'none', cursor: 'pointer', opacity: registerMutation.isPending ? 0.5 : 1 }}
        >
          {registerMutation.isPending ? 'REGISTERING...' : 'REGISTER →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#FFCD32', textDecoration: 'none' }}>Log in →</Link>
      </p>
    </AuthShell>
  )
}
