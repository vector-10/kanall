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

export default function SettingsPage() {
  const queryClient = useQueryClient()

  const [modal, setModal] = useState<{ key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [webhookSecretVisible, setWebhookSecretVisible] = useState<string | null>(null)
  const [webhookCopied, setWebhookCopied] = useState(false)

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
    },
  })

  const kycMutation = useMutation({
    mutationFn: () => api.auth.submitBusinessKYC(businessType, cacNumber || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const webhookSecretMutation = useMutation({
    mutationFn: api.auth.webhookSecret,
    onSuccess: (data) => {
      setWebhookSecretVisible(data.webhookSecret)
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

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ border: '1px solid #2A2A2A', padding: '24px', marginBottom: 20 }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#666', marginBottom: 20 }}>
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 640 }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
        DASHBOARD
      </div>
      <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em', marginBottom: 32 }}>
        SETTINGS
      </h1>

      {/* API Key */}
      {section('API KEY', (
        <>
          {suffix ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...MONO, fontSize: 13, color: '#F5F5F5', letterSpacing: '0.06em' }}>
                  {'•'.repeat(24)}{suffix}
                </span>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '2px 8px' }}>
                  ACTIVE
                </span>
              </div>
              <button onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}
                style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: '#888888', border: '1px solid #2A2A2A', cursor: 'pointer', opacity: rotateMutation.isPending ? 0.5 : 1 }}>
                {rotateMutation.isPending ? 'ROTATING...' : 'ROTATE KEY'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...MONO, fontSize: 12, color: '#555' }}>No API key generated yet</span>
              <button onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}
                style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', background: '#FFCD32', color: '#0D0D0D', border: 'none', cursor: 'pointer', opacity: rotateMutation.isPending ? 0.5 : 1 }}>
                {rotateMutation.isPending ? 'GENERATING...' : 'GENERATE API KEY'}
              </button>
            </div>
          )}
          {rotateMutation.error && (
            <p style={{ ...MONO, fontSize: 11, color: '#ef4444', marginTop: 12, letterSpacing: '0.06em' }}>
              {rotateMutation.error.message}
            </p>
          )}
        </>
      ))}

      {/* Business KYC */}
      {section('BUSINESS VERIFICATION', (
        <>
          {kycVerified ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '4px 12px' }}>
                VERIFIED
              </span>
              <span style={{ ...MONO, fontSize: 11, color: '#888' }}>
                {me?.businessType?.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 18, lineHeight: 1.6 }}>
                Submit your business information to verify your account. This unlocks higher account limits and compliance features.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#555', marginBottom: 6 }}>BUSINESS TYPE</div>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    style={{ ...MONO, fontSize: 12, background: '#0A0A0A', border: '1px solid #2A2A2A', color: businessType ? '#C0C0C0' : '#555', padding: '9px 12px', width: '100%', outline: 'none' }}
                  >
                    <option value="">Select business type</option>
                    {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {businessType === 'registered_business' && (
                  <div>
                    <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#555', marginBottom: 6 }}>CAC NUMBER</div>
                    <input
                      type="text"
                      value={cacNumber}
                      onChange={e => setCACNumber(e.target.value)}
                      placeholder="RC000000"
                      style={{ ...MONO, fontSize: 12, background: '#0A0A0A', border: '1px solid #2A2A2A', color: '#C0C0C0', padding: '9px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <button
                  onClick={() => kycMutation.mutate()}
                  disabled={kycMutation.isPending || !businessType}
                  style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '10px', background: '#FFCD32', color: '#0D0D0D', border: 'none', cursor: 'pointer', opacity: (kycMutation.isPending || !businessType) ? 0.5 : 1, alignSelf: 'flex-start' }}
                >
                  {kycMutation.isPending ? 'SUBMITTING...' : 'SUBMIT KYC'}
                </button>
                {kycMutation.error && (
                  <p style={{ ...MONO, fontSize: 11, color: '#ef4444', letterSpacing: '0.06em' }}>
                    {kycMutation.error.message}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      ))}

      {/* Outbound Webhook Secret */}
      {section('OUTBOUND WEBHOOK SECRET', (
        <>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 18, lineHeight: 1.6 }}>
            Kanall signs outbound webhook deliveries with HMAC-SHA256. Use this secret to verify callbacks in your server.
            Each request includes an <code style={{ ...MONO, fontSize: 11, color: '#FFCD32' }}>X-Kanall-Signature</code> header.
          </p>
          {webhookSecretVisible ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...MONO, fontSize: 12, color: '#FFCD32', background: '#0A0A0A', border: '1px solid #2A2A2A', padding: '12px 16px', wordBreak: 'break-all', letterSpacing: '0.04em', marginBottom: 10, userSelect: 'all' }}>
                {webhookSecretVisible}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copyWebhookSecret} style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', background: webhookCopied ? 'transparent' : '#FFCD32', color: webhookCopied ? '#888' : '#0D0D0D', border: webhookCopied ? '1px solid #2A2A2A' : 'none', cursor: 'pointer' }}>
                  {webhookCopied ? 'COPIED ✓' : 'COPY'}
                </button>
                <button onClick={() => setWebhookSecretVisible(null)} style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: '#555', border: '1px solid #2A2A2A', cursor: 'pointer' }}>
                  HIDE
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => webhookSecretMutation.mutate()}
              disabled={webhookSecretMutation.isPending}
              style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '9px 18px', background: 'transparent', color: '#888888', border: '1px solid #2A2A2A', cursor: 'pointer', opacity: webhookSecretMutation.isPending ? 0.5 : 1 }}
            >
              {webhookSecretMutation.isPending ? 'LOADING...' : 'REVEAL SECRET'}
            </button>
          )}
          {webhookSecretMutation.error && (
            <p style={{ ...MONO, fontSize: 11, color: '#ef4444', marginTop: 10, letterSpacing: '0.06em' }}>
              {webhookSecretMutation.error.message}
            </p>
          )}
        </>
      ))}

      {/* API Key reveal modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', padding: '32px', maxWidth: 520, width: '90%' }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#666', marginBottom: 8 }}>YOUR API KEY</div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
              Copy this key now and store it securely. You will not be able to see the full key again.
            </p>
            <div style={{ ...MONO, fontSize: 12, color: '#FFCD32', background: '#0A0A0A', border: '1px solid #2A2A2A', padding: '12px 16px', wordBreak: 'break-all', marginBottom: 20, letterSpacing: '0.04em', userSelect: 'all' }}>
              {modal.key}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copy} style={{ ...MONO, flex: 1, fontSize: 10, letterSpacing: '0.12em', padding: '10px', background: copied ? 'transparent' : '#FFCD32', color: copied ? '#888' : '#0D0D0D', border: copied ? '1px solid #2A2A2A' : 'none', cursor: 'pointer' }}>
                {copied ? 'COPIED ✓' : 'COPY KEY'}
              </button>
              <button onClick={() => { setModal(null); setCopied(false) }} style={{ ...MONO, flex: 1, fontSize: 10, letterSpacing: '0.12em', padding: '10px', background: 'transparent', color: '#555', border: '1px solid #2A2A2A', cursor: 'pointer' }}>
                I'VE COPIED IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
