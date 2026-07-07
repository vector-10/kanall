import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

const MONO = { fontFamily: 'var(--font-mono)' }

const TIER_LABELS: Record<number, string> = {
  1: 'TIER 1 — BVN COLLECTED',
  2: 'TIER 2 — BVN + NIN VERIFIED',
  3: 'TIER 3 — FULL KYC',
}

const TIER_LIMITS: Record<number, { daily: string; balance: string }> = {
  1: { daily: '₦50,000', balance: '₦300,000' },
  2: { daily: '₦200,000', balance: '₦500,000' },
  3: { daily: '₦5,000,000', balance: 'No cap' },
}

const TIER_COLORS: Record<number, string> = {
  1: '#888888',
  2: '#FFCD32',
  3: '#22c55e',
}

const KYC_STATUS_COLOR: Record<string, string> = {
  none: 'var(--text-faint)',
  pending_review: '#FFCD32',
  approved: '#22c55e',
  rejected: 'var(--red)',
}

const KYC_STATUS_LABEL: Record<string, string> = {
  none: 'KYC NONE',
  pending_review: 'KYC PENDING REVIEW',
  approved: 'KYC APPROVED',
  rejected: 'KYC REJECTED',
}

const inputStyle: React.CSSProperties = {
  ...MONO, fontSize: 13, background: 'var(--surface-raised)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '9px 12px', outline: 'none', boxSizing: 'border-box',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [ninInput, setNINInput] = useState('')
  const [ninError, setNINError] = useState('')
  const [adminError, setAdminError] = useState('')

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.customers.get(id!),
    enabled: !!id,
  })

  const { data: linkedAccount } = useQuery({
    queryKey: ['customer-account', id],
    queryFn: () => api.customers.getAccount(id!),
    enabled: !!id,
    retry: false,
  })

  const kycMutation = useMutation({
    mutationFn: (nin: string) => api.customers.upgradeKYC(id!, nin),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customer', id], updated)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setNINInput(''); setNINError('')
    },
    onError: (err: Error) => setNINError(err.message),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.customers.approveKYC(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customer', id], updated)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setAdminError('')
    },
    onError: (err: Error) => setAdminError(err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.customers.rejectKYC(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customer', id], updated)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setAdminError('')
    },
    onError: (err: Error) => setAdminError(err.message),
  })

  const handleKYCUpgrade = () => {
    if (ninInput.length !== 11 || !/^\d+$/.test(ninInput)) {
      setNINError('NIN must be exactly 11 digits')
      return
    }
    setNINError('')
    kycMutation.mutate(ninInput)
  }

  if (isLoading) return (
    <div style={{ ...MONO, padding: 28, fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.12em' }}>LOADING...</div>
  )
  if (error) return (
    <div style={{ ...MONO, padding: 28, fontSize: 12, color: 'var(--red)', letterSpacing: '0.1em' }}>{(error as Error).message}</div>
  )
  if (!customer) return null

  const tierColor = TIER_COLORS[customer.KYCTier] ?? '#888888'
  const tierLabel = TIER_LABELS[customer.KYCTier] ?? `TIER ${customer.KYCTier}`
  const limits = TIER_LIMITS[customer.KYCTier] ?? TIER_LIMITS[1]
  const kycStatus = customer.KYCStatus ?? 'none'
  const statusColor = KYC_STATUS_COLOR[kycStatus] ?? 'var(--text-faint)'
  const statusLabel = KYC_STATUS_LABEL[kycStatus] ?? kycStatus.toUpperCase()

  const rows: [string, string | null][] = [
    ['EXTERNAL REF', customer.ExternalRef],
    ['BVN LAST 4', customer.BVNLast4 ? `••••••• ${customer.BVNLast4}` : null],
    ['NIN LAST 4', customer.NINLast4 ? `••••••• ${customer.NINLast4}` : null],
    ['STATUS', customer.Status.toUpperCase()],
    ['CREATED', new Date(customer.CreatedAt).toLocaleString()],
  ]

  const adminBusy = approveMutation.isPending || rejectMutation.isPending

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Back */}
      <Link
        to="/customers"
        style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', textDecoration: 'none', letterSpacing: '0.12em', display: 'inline-block', marginBottom: 24 }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}
      >
        ← CUSTOMERS
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 4 }}>CUSTOMER</div>
          <h1 style={{ ...MONO, fontSize: 20, color: 'var(--text)', letterSpacing: '0.04em' }}>{customer.Name}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ ...MONO, fontSize: 11, letterSpacing: '0.1em', color: tierColor, background: `${tierColor}1A`, border: `1px solid ${tierColor}44`, padding: '4px 12px' }}>
            {tierLabel}
          </span>
          <span style={{ ...MONO, fontSize: 10, letterSpacing: '0.1em', color: statusColor, padding: '3px 0' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 40, alignItems: 'start' }}>

        {/* ── Left: KV rows + upgrade form ── */}
        <div>
          <div style={{ border: '1px solid var(--border)', marginBottom: 24 }}>
            {rows.map(([label, value], i) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '10px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', width: 130, flexShrink: 0, paddingTop: 1 }}>
                  {label}
                </span>
                <span style={{ ...MONO, fontSize: 13, color: value ? 'var(--text)' : 'var(--text-faint)', letterSpacing: '0.04em' }}>
                  {value ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {/* KYC upgrade form — show when tier < 2 AND status is none */}
          {customer.KYCTier < 2 && kycStatus === 'none' && (
            <div style={{ border: '1px solid var(--border)', padding: '20px' }}>
              <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 12 }}>
                UPGRADE TO TIER 2
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Submit NIN and a document image to request Tier 2. Increases daily limit to ₦200,000 and balance cap to ₦500,000.
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input
                  type="text"
                  value={ninInput}
                  onChange={e => setNINInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="11-digit NIN"
                  style={{ ...inputStyle, flex: 1, letterSpacing: '0.06em' }}
                />
              </div>
              <button
                onClick={handleKYCUpgrade}
                disabled={kycMutation.isPending}
                style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', cursor: kycMutation.isPending ? 'not-allowed' : 'pointer', opacity: kycMutation.isPending ? 0.5 : 1 }}
              >
                {kycMutation.isPending ? '...' : 'SUBMIT FOR REVIEW'}
              </button>
              {ninError && (
                <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', marginTop: 10, letterSpacing: '0.06em' }}>{ninError}</p>
              )}
            </div>
          )}

          {kycStatus === 'rejected' && customer.KYCTier < 2 && (
            <div style={{ border: '1px solid rgba(239,68,68,0.25)', padding: '14px 16px' }}>
              <span style={{ ...MONO, fontSize: 11, color: 'var(--red)', letterSpacing: '0.12em' }}>
                KYC REJECTED — customer may resubmit with corrected documents.
              </span>
            </div>
          )}

          {customer.KYCTier === 2 && (
            <div style={{ border: '1px solid rgba(34,197,94,0.25)', padding: '14px 16px' }}>
              <span style={{ ...MONO, fontSize: 11, color: '#22c55e', letterSpacing: '0.12em' }}>
                TIER 3 UPGRADE — requires manual review. Contact support.
              </span>
            </div>
          )}
        </div>

        {/* ── Right: linked account + limits + admin panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Linked account card */}
          {linkedAccount ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 14 }}>LINKED ACCOUNT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 3 }}>NUBAN</div>
                  <div style={{ ...MONO, fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em' }}>{linkedAccount.BankAccountNumber ?? '—'}</div>
                </div>
                <div>
                  <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 3 }}>ACCOUNT NAME</div>
                  <div style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>{linkedAccount.BankAccountName ?? '—'}</div>
                </div>
                <div>
                  <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 3 }}>REF</div>
                  <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>{linkedAccount.AccountRef}</div>
                </div>
              </div>
              <Link
                to={`/accounts/${linkedAccount.AccountRef}`}
                style={{ ...MONO, display: 'block', marginTop: 16, fontSize: 11, letterSpacing: '0.12em', color: 'var(--accent)', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
              >
                VIEW STATEMENT →
              </Link>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 20px' }}>
              <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 8 }}>LINKED ACCOUNT</div>
              <div style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>No account provisioned</div>
            </div>
          )}

          {/* Limits card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '18px 20px' }}>
            <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 14 }}>KYC LIMITS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>DAILY LIMIT</div>
                <div style={{ ...MONO, fontSize: 17, color: 'var(--text)' }}>{limits.daily}</div>
              </div>
              <div>
                <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>BALANCE CAP</div>
                <div style={{ ...MONO, fontSize: 17, color: 'var(--text)' }}>{limits.balance}</div>
              </div>
            </div>
          </div>

          {/* Admin review panel — visible when pending_review */}
          {kycStatus === 'pending_review' && (
            <div style={{ border: '1px solid rgba(255,205,50,0.3)', padding: '18px 20px' }}>
              <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 10 }}>
                PENDING KYC REVIEW
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                NIN and document submitted. Approve to upgrade to Tier 2, or reject to request resubmission.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => { setAdminError(''); approveMutation.mutate() }}
                  disabled={adminBusy}
                  style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px', background: '#22c55e', color: '#0D0D0D', border: 'none', cursor: adminBusy ? 'not-allowed' : 'pointer', opacity: adminBusy ? 0.5 : 1 }}
                >
                  {approveMutation.isPending ? '...' : 'APPROVE →'}
                </button>
                <button
                  onClick={() => { setAdminError(''); rejectMutation.mutate() }}
                  disabled={adminBusy}
                  style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', cursor: adminBusy ? 'not-allowed' : 'pointer', opacity: adminBusy ? 0.5 : 1 }}
                >
                  {rejectMutation.isPending ? '...' : 'REJECT'}
                </button>
              </div>
              {adminError && (
                <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', marginTop: 10, letterSpacing: '0.06em' }}>{adminError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
