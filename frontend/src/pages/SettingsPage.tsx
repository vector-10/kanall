import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

const MONO = { fontFamily: 'var(--font-mono)' }

const BUSINESS_TYPES = [
  { value: 'sole_proprietor',     label: 'Sole Proprietor' },
  { value: 'registered_business', label: 'Registered Business (CAC)' },
  { value: 'ngo',                 label: 'NGO / Non-Profit' },
  { value: 'other',               label: 'Other' },
]

const inputStyle: React.CSSProperties = {
  ...MONO, fontSize: 13, background: 'var(--surface-raised)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '9px 12px', width: '100%', outline: 'none', boxSizing: 'border-box',
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', padding: '22px 22px' }}>
      <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 18 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const queryClient = useQueryClient()

  const [showRotateConfirm, setShowRotateConfirm] = useState(false)
  const [modal, setModal] = useState<{ key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [webhookSecretVisible, setWebhookSecretVisible] = useState<string | null>(null)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [editingWebhookUrl, setEditingWebhookUrl] = useState(false)

  const [businessType, setBusinessType] = useState('')
  const [cacNumber, setCACNumber] = useState('')

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
    staleTime: 5 * 60_000,
  })

  const rotateMutation = useMutation({
    mutationFn: api.auth.rotateKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setModal({ key: data.apiKey })
      setShowRotateConfirm(false)
    },
  })

  const kycMutation = useMutation({
    mutationFn: () => api.auth.submitBusinessKYC(businessType, cacNumber || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['me'] }) },
  })

  const webhookSecretMutation = useMutation({
    mutationFn: api.auth.webhookSecret,
    onSuccess: (data) => { setWebhookSecretVisible(data.webhookSecret) },
  })

  const webhookUrlMutation = useMutation({
    mutationFn: (url: string) => api.auth.setWebhookUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingWebhookUrl(false)
      setWebhookUrlInput('')
    },
  })

  const copy = () => {
    if (!modal) return
    navigator.clipboard.writeText(modal.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyWebhookSecret = () => {
    if (!webhookSecretVisible) return
    navigator.clipboard.writeText(webhookSecretVisible)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const suffix = me?.apiKeySuffix
  const kycVerified = me?.kycStatus === 'verified'

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 5 }}>DASHBOARD</div>
        <h1 style={{ ...MONO, fontSize: 19, color: 'var(--text)', letterSpacing: '0.08em' }}>SETTINGS</h1>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left column: Webhook URL + API Key + Webhook Secret ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Webhook URL */}
          <Card title="WEBHOOK URL">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              All payment notifications are delivered here. Set this once — every virtual account you provision will use it automatically.
            </p>
            {me?.webhookUrl && !editingWebhookUrl ? (
              <div>
                <div style={{ ...MONO, fontSize: 12, color: 'var(--accent)', background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '10px 14px', wordBreak: 'break-all', letterSpacing: '0.02em', marginBottom: 12 }}>
                  {me.webhookUrl}
                </div>
                <button
                  onClick={() => { setEditingWebhookUrl(true); setWebhookUrlInput(me.webhookUrl ?? '') }}
                  style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  UPDATE
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="url"
                  value={webhookUrlInput}
                  onChange={e => setWebhookUrlInput(e.target.value)}
                  placeholder="https://your-backend.com/webhooks/kanall"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => webhookUrlMutation.mutate(webhookUrlInput)}
                    disabled={webhookUrlMutation.isPending || !webhookUrlInput}
                    style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', opacity: (webhookUrlMutation.isPending || !webhookUrlInput) ? 0.5 : 1 }}
                  >
                    {webhookUrlMutation.isPending ? 'SAVING...' : 'SAVE'}
                  </button>
                  {editingWebhookUrl && (
                    <button
                      onClick={() => { setEditingWebhookUrl(false); setWebhookUrlInput('') }}
                      style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      CANCEL
                    </button>
                  )}
                </div>
                {webhookUrlMutation.error && (
                  <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', letterSpacing: '0.06em' }}>{webhookUrlMutation.error.message}</p>
                )}
              </div>
            )}
          </Card>

          {/* API Key */}
          <Card title="API KEY">
            {suffix ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...MONO, fontSize: 14, color: 'var(--text)', letterSpacing: '0.06em' }}>
                      {'•'.repeat(24)}{suffix}
                    </span>
                    <span style={{ ...MONO, fontSize: 10, letterSpacing: '0.1em', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid rgba(22,163,74,0.2)', padding: '2px 8px' }}>
                      ACTIVE
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowRotateConfirm(true)}
                  style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  ROTATE KEY
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  No API key yet. Generate one to start authenticating requests.
                </p>
                <button
                  onClick={() => rotateMutation.mutate()}
                  disabled={rotateMutation.isPending}
                  style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px 18px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', opacity: rotateMutation.isPending ? 0.5 : 1 }}
                >
                  {rotateMutation.isPending ? 'GENERATING...' : 'GENERATE API KEY'}
                </button>
              </div>
            )}
            {rotateMutation.error && (
              <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', marginTop: 12, letterSpacing: '0.06em' }}>
                {rotateMutation.error.message}
              </p>
            )}
          </Card>

          {/* Webhook Secret */}
          <Card title="OUTBOUND WEBHOOK SECRET">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Kanall signs callbacks with HMAC-SHA256. Verify using the{' '}
              <code style={{ ...MONO, fontSize: 12, color: 'var(--accent)' }}>X-Kanall-Signature</code> header.
            </p>
            {webhookSecretVisible ? (
              <div>
                <div style={{ ...MONO, fontSize: 13, color: 'var(--accent)', background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px 16px', wordBreak: 'break-all', letterSpacing: '0.04em', marginBottom: 10, userSelect: 'all' }}>
                  {webhookSecretVisible}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={copyWebhookSecret} style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '8px 16px', background: webhookCopied ? 'transparent' : 'var(--accent)', color: webhookCopied ? 'var(--text-muted)' : 'var(--accent-fg)', border: webhookCopied ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                    {webhookCopied ? 'COPIED ✓' : 'COPY'}
                  </button>
                  <button onClick={() => setWebhookSecretVisible(null)} style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    HIDE
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => webhookSecretMutation.mutate()}
                disabled={webhookSecretMutation.isPending}
                style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '9px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', opacity: webhookSecretMutation.isPending ? 0.5 : 1 }}
              >
                {webhookSecretMutation.isPending ? 'LOADING...' : 'REVEAL SECRET'}
              </button>
            )}
            {webhookSecretMutation.error && (
              <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', marginTop: 10 }}>
                {webhookSecretMutation.error.message}
              </p>
            )}
          </Card>
        </div>

        {/* ── Right column: Business KYC + Account info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Business KYC */}
          <Card title="BUSINESS VERIFICATION">
            {kycVerified ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...MONO, fontSize: 10, letterSpacing: '0.1em', color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid rgba(22,163,74,0.2)', padding: '4px 12px' }}>
                  VERIFIED
                </span>
                <span style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>
                  {me?.businessType?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
                  Verify your business to unlock higher account limits and compliance features.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>BUSINESS TYPE</div>
                    <select
                      value={businessType}
                      onChange={e => setBusinessType(e.target.value)}
                      style={{ ...inputStyle, color: businessType ? 'var(--text)' : 'var(--text-faint)' }}
                    >
                      <option value="">Select type...</option>
                      {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {businessType === 'registered_business' && (
                    <div>
                      <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>CAC NUMBER</div>
                      <input
                        type="text"
                        value={cacNumber}
                        onChange={e => setCACNumber(e.target.value)}
                        placeholder="RC000000"
                        style={inputStyle}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => kycMutation.mutate()}
                    disabled={kycMutation.isPending || !businessType}
                    style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '10px 18px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', opacity: (kycMutation.isPending || !businessType) ? 0.5 : 1, alignSelf: 'flex-start' }}
                  >
                    {kycMutation.isPending ? 'SUBMITTING...' : 'SUBMIT KYC'}
                  </button>
                  {kycMutation.error && (
                    <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', letterSpacing: '0.06em' }}>{kycMutation.error.message}</p>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Account info */}
          {me && (
            <Card title="ACCOUNT">
              {([
                ['NAME',    me.name],
                ['EMAIL',   me.email ?? '—'],
                ['STATUS',  me.status?.toUpperCase() ?? '—'],
                ['KYC',     me.kycStatus?.toUpperCase() ?? '—'],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 20, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-faint)', width: 60, flexShrink: 0, paddingTop: 1 }}>{label}</span>
                  <span style={{ ...MONO, fontSize: 13, color: 'var(--text)', letterSpacing: '0.04em' }}>{val}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* ── Rotate key confirmation modal ── */}
      {showRotateConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 32, maxWidth: 420, width: '90%' }}>
            <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--red)', marginBottom: 12 }}>DESTRUCTIVE ACTION</div>
            <h3 style={{ ...MONO, fontSize: 15, color: 'var(--text)', letterSpacing: '0.04em', marginBottom: 10 }}>Rotate API Key?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Your current key will be immediately invalidated. Any service using it will stop working until updated.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowRotateConfirm(false)} style={{ ...MONO, flex: 1, fontSize: 11, letterSpacing: '0.12em', padding: '9px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                CANCEL
              </button>
              <button
                onClick={() => rotateMutation.mutate()}
                disabled={rotateMutation.isPending}
                style={{ ...MONO, flex: 1, fontSize: 11, letterSpacing: '0.12em', padding: '9px', background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', cursor: 'pointer', opacity: rotateMutation.isPending ? 0.5 : 1 }}
              >
                {rotateMutation.isPending ? 'ROTATING...' : 'CONFIRM ROTATE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New key reveal modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 32, maxWidth: 520, width: '90%' }}>
            <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 8 }}>YOUR NEW API KEY</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Copy and store this now. You will not be able to see the full key again.
            </p>
            <div style={{ ...MONO, fontSize: 13, color: 'var(--accent)', background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '12px 16px', wordBreak: 'break-all', marginBottom: 20, letterSpacing: '0.04em', userSelect: 'all' }}>
              {modal.key}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copy} style={{ ...MONO, flex: 1, fontSize: 11, letterSpacing: '0.12em', padding: '10px', background: copied ? 'transparent' : 'var(--accent)', color: copied ? 'var(--text-muted)' : 'var(--accent-fg)', border: copied ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                {copied ? 'COPIED ✓' : 'COPY KEY'}
              </button>
              <button onClick={() => { setModal(null); setCopied(false) }} style={{ ...MONO, flex: 1, fontSize: 11, letterSpacing: '0.12em', padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                I'VE COPIED IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
