import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

const MONO = { fontFamily: 'var(--font-mono)' }

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ key: string } | null>(null)
  const [copied, setCopied] = useState(false)

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

  const copy = () => {
    if (!modal) return
    navigator.clipboard.writeText(modal.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const suffix = me?.apiKeySuffix

  return (
    <div style={{ padding: '32px 28px', maxWidth: 640 }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
        DASHBOARD
      </div>
      <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em', marginBottom: 32 }}>
        SETTINGS
      </h1>

      <div style={{ border: '1px solid #2A2A2A', padding: '24px' }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#666', marginBottom: 16 }}>
          API KEY
        </div>

        {suffix ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...MONO, fontSize: 13, color: '#F5F5F5', letterSpacing: '0.06em' }}>
                {'•'.repeat(24)}{suffix}
              </span>
              <span style={{
                ...MONO,
                fontSize: 9,
                letterSpacing: '0.1em',
                color: '#22c55e',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                padding: '2px 8px',
              }}>
                ACTIVE
              </span>
            </div>
            <button
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '8px 16px',
                background: 'transparent',
                color: '#888888',
                border: '1px solid #2A2A2A',
                cursor: 'pointer',
                opacity: rotateMutation.isPending ? 0.5 : 1,
              }}
            >
              {rotateMutation.isPending ? 'ROTATING...' : 'ROTATE KEY'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...MONO, fontSize: 12, color: '#555' }}>No API key generated yet</span>
            <button
              onClick={() => rotateMutation.mutate()}
              disabled={rotateMutation.isPending}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '8px 16px',
                background: '#FFCD32',
                color: '#0D0D0D',
                border: 'none',
                cursor: 'pointer',
                opacity: rotateMutation.isPending ? 0.5 : 1,
              }}
            >
              {rotateMutation.isPending ? 'GENERATING...' : 'GENERATE API KEY'}
            </button>
          </div>
        )}

        {rotateMutation.error && (
          <p style={{ ...MONO, fontSize: 11, color: '#ef4444', marginTop: 12, letterSpacing: '0.06em' }}>
            {rotateMutation.error.message}
          </p>
        )}
      </div>

      {modal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #2A2A2A',
            padding: '32px',
            maxWidth: 520,
            width: '90%',
          }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#666', marginBottom: 8 }}>
              YOUR API KEY
            </div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
              Copy this key now and store it securely. You will not be able to see the full key again — only the last 4 characters will be shown.
            </p>
            <div style={{
              ...MONO,
              fontSize: 12,
              color: '#FFCD32',
              background: '#0A0A0A',
              border: '1px solid #2A2A2A',
              padding: '12px 16px',
              wordBreak: 'break-all',
              marginBottom: 20,
              letterSpacing: '0.04em',
              userSelect: 'all',
            }}>
              {modal.key}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={copy}
                style={{
                  ...MONO,
                  flex: 1,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  padding: '10px',
                  background: copied ? 'transparent' : '#FFCD32',
                  color: copied ? '#888' : '#0D0D0D',
                  border: copied ? '1px solid #2A2A2A' : 'none',
                  cursor: 'pointer',
                }}
              >
                {copied ? 'COPIED ✓' : 'COPY KEY'}
              </button>
              <button
                onClick={() => { setModal(null); setCopied(false) }}
                style={{
                  ...MONO,
                  flex: 1,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  padding: '10px',
                  background: 'transparent',
                  color: '#555',
                  border: '1px solid #2A2A2A',
                  cursor: 'pointer',
                }}
              >
                I'VE COPIED IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
