import { useRef, useState } from 'react'
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
  none: '#555555',
  pending_review: '#FFCD32',
  approved: '#22c55e',
  rejected: '#EF4444',
}

const KYC_STATUS_LABEL: Record<string, string> = {
  none: 'KYC NONE',
  pending_review: 'KYC PENDING REVIEW',
  approved: 'KYC APPROVED',
  rejected: 'KYC REJECTED',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ninInput, setNINInput] = useState('')
  const [ninDoc, setNinDoc] = useState<string>('')
  const [ninDocName, setNinDocName] = useState<string>('')
  const [ninError, setNINError] = useState('')
  const [adminError, setAdminError] = useState('')

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.customers.get(id!),
    enabled: !!id,
  })

  const kycMutation = useMutation({
    mutationFn: ({ nin, doc }: { nin: string; doc: string }) =>
      api.customers.upgradeKYC(id!, nin, doc),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customer', id], updated)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setNINInput('')
      setNinDoc('')
      setNinDocName('')
      setNINError('')
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNinDocName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1] ?? ''
      setNinDoc(b64)
    }
    reader.readAsDataURL(file)
  }

  const handleKYCUpgrade = () => {
    if (ninInput.length !== 11 || !/^\d+$/.test(ninInput)) {
      setNINError('NIN must be exactly 11 digits')
      return
    }
    if (!ninDoc) {
      setNINError('NIN document image is required')
      return
    }
    setNINError('')
    kycMutation.mutate({ nin: ninInput, doc: ninDoc })
  }

  if (isLoading) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: '#888888', letterSpacing: '0.12em' }}>
      LOADING...
    </div>
  )
  if (error) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: '#EF4444', letterSpacing: '0.1em' }}>
      {(error as Error).message}
    </div>
  )
  if (!customer) return null

  const tierColor = TIER_COLORS[customer.KYCTier] ?? '#888888'
  const tierLabel = TIER_LABELS[customer.KYCTier] ?? `TIER ${customer.KYCTier}`
  const limits = TIER_LIMITS[customer.KYCTier] ?? TIER_LIMITS[1]
  const kycStatus = customer.KYCStatus ?? 'none'
  const statusColor = KYC_STATUS_COLOR[kycStatus] ?? '#555555'
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
    <div style={{ padding: '32px 28px', maxWidth: 660 }}>
      <Link
        to="/customers"
        style={{ ...MONO, fontSize: 10, color: '#888888', textDecoration: 'none', letterSpacing: '0.12em', display: 'inline-block', marginBottom: 28 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FFCD32' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#888888' }}
      >
        ← CUSTOMERS
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ ...MONO, fontSize: 20, color: '#F5F5F5', letterSpacing: '0.06em', marginBottom: 6 }}>
            {customer.Name}
          </h1>
          <span style={{ ...MONO, fontSize: 9, color: '#666', letterSpacing: '0.14em' }}>
            CUSTOMER
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{
            ...MONO,
            fontSize: 10,
            letterSpacing: '0.1em',
            color: tierColor,
            background: `${tierColor}14`,
            border: `1px solid ${tierColor}33`,
            padding: '4px 12px',
          }}>
            {tierLabel}
          </span>
          <span style={{
            ...MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            color: statusColor,
            background: `${statusColor}14`,
            border: `1px solid ${statusColor}33`,
            padding: '3px 10px',
          }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* KYC Limits */}
      <div style={{ border: '1px solid #2A2A2A', padding: '16px', marginBottom: 20, display: 'flex', gap: 40 }}>
        <div>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#555', marginBottom: 4 }}>DAILY LIMIT</div>
          <div style={{ ...MONO, fontSize: 14, color: '#C0C0C0' }}>{limits.daily}</div>
        </div>
        <div>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#555', marginBottom: 4 }}>BALANCE CAP</div>
          <div style={{ ...MONO, fontSize: 14, color: '#C0C0C0' }}>{limits.balance}</div>
        </div>
      </div>

      {/* KV rows */}
      <div style={{ border: '1px solid #2A2A2A', marginBottom: 20 }}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            padding: '10px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid #1A1A1A' : 'none',
          }}>
            <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#888888', width: 130, flexShrink: 0, paddingTop: 1 }}>
              {label}
            </span>
            <span style={{ ...MONO, fontSize: 12, color: value ? '#C0C0C0' : '#555555' }}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Admin: Approve / Reject — visible only when pending_review */}
      {kycStatus === 'pending_review' && (
        <div style={{ border: '1px solid rgba(255,205,50,0.25)', padding: '20px', marginBottom: 20 }}>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#FFCD32', marginBottom: 12 }}>
            PENDING KYC REVIEW
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            NIN and document have been submitted. Approve to upgrade to Tier 2, or reject to request resubmission.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setAdminError(''); approveMutation.mutate() }}
              disabled={adminBusy}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '9px 20px',
                background: '#22c55e',
                color: '#0D0D0D',
                border: 'none',
                cursor: adminBusy ? 'not-allowed' : 'pointer',
                opacity: adminBusy ? 0.5 : 1,
              }}
            >
              {approveMutation.isPending ? '...' : 'APPROVE'}
            </button>
            <button
              onClick={() => { setAdminError(''); rejectMutation.mutate() }}
              disabled={adminBusy}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '9px 20px',
                background: 'transparent',
                color: '#EF4444',
                border: '1px solid #EF444444',
                cursor: adminBusy ? 'not-allowed' : 'pointer',
                opacity: adminBusy ? 0.5 : 1,
              }}
            >
              {rejectMutation.isPending ? '...' : 'REJECT'}
            </button>
          </div>
          {adminError && (
            <p style={{ ...MONO, fontSize: 11, color: '#EF4444', marginTop: 10, letterSpacing: '0.06em' }}>
              {adminError}
            </p>
          )}
        </div>
      )}

      {/* KYC Upgrade form — show when tier < 2 AND not pending/approved */}
      {customer.KYCTier < 2 && kycStatus === 'none' && (
        <div style={{ border: '1px solid #2A2A2A', padding: '20px', marginBottom: 20 }}>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#FFCD32', marginBottom: 12 }}>
            UPGRADE TO TIER 2
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
            Submit a NIN and a document image to request Tier 2 upgrade. Increases daily limit to ₦200,000 and balance cap to ₦500,000.
          </p>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
            <input
              type="text"
              value={ninInput}
              onChange={e => setNINInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="11-digit NIN"
              style={{
                ...MONO,
                flex: 1,
                fontSize: 12,
                background: '#0A0A0A',
                border: '1px solid #2A2A2A',
                color: '#C0C0C0',
                padding: '9px 12px',
                letterSpacing: '0.06em',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.1em',
                padding: '8px 14px',
                background: 'transparent',
                color: '#888',
                border: '1px solid #2A2A2A',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ATTACH DOCUMENT
            </button>
            <span style={{ ...MONO, fontSize: 11, color: ninDoc ? '#C0C0C0' : '#555' }}>
              {ninDocName || 'No file selected'}
            </span>
          </div>

          <button
            onClick={handleKYCUpgrade}
            disabled={kycMutation.isPending}
            style={{
              ...MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              padding: '9px 18px',
              background: '#FFCD32',
              color: '#0D0D0D',
              border: 'none',
              cursor: kycMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: kycMutation.isPending ? 0.5 : 1,
            }}
          >
            {kycMutation.isPending ? '...' : 'SUBMIT FOR REVIEW'}
          </button>

          {ninError && (
            <p style={{ ...MONO, fontSize: 11, color: '#EF4444', marginTop: 10, letterSpacing: '0.06em' }}>
              {ninError}
            </p>
          )}
        </div>
      )}

      {kycStatus === 'rejected' && customer.KYCTier < 2 && (
        <div style={{ border: '1px solid rgba(239,68,68,0.2)', padding: '16px', marginBottom: 20 }}>
          <span style={{ ...MONO, fontSize: 10, color: '#EF4444', letterSpacing: '0.12em' }}>
            KYC REJECTED — customer may resubmit with corrected documents.
          </span>
        </div>
      )}

      {customer.KYCTier === 2 && (
        <div style={{ border: '1px solid rgba(34,197,94,0.2)', padding: '16px', marginBottom: 20 }}>
          <span style={{ ...MONO, fontSize: 10, color: '#22c55e', letterSpacing: '0.12em' }}>
            TIER 3 UPGRADE — requires manual review. Contact support.
          </span>
        </div>
      )}
    </div>
  )
}
