import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'

const MAX_ATTEMPTS = 5
const MONO = { fontFamily: 'var(--font-mono)' }

type Tab = 'dead-letters' | 'misdirected' | 'needs-review'

export default function DeadLettersPage() {
  const [tab, setTab] = useState<Tab>('dead-letters')

  const { data: dlData, isLoading: dlLoading, error: dlError } = useQuery({
    queryKey: ['dead-letters'],
    queryFn: api.deadLetters,
  })

  const { data: mdData, isLoading: mdLoading } = useQuery({
    queryKey: ['misdirected'],
    queryFn: api.webhooks.misdirected,
    enabled: tab === 'misdirected',
  })

  const { data: nrData, isLoading: nrLoading } = useQuery({
    queryKey: ['needs-review'],
    queryFn: api.webhooks.needsReview,
    enabled: tab === 'needs-review',
  })

  const items = dlData?.deadLetters ?? []
  const misdirected = mdData?.events ?? []
  const needsReview = nrData?.entries ?? []

  const tabStyle = (active: boolean): React.CSSProperties => ({
    ...MONO, fontSize: 11, letterSpacing: '0.12em', padding: '8px 18px',
    background: 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    border: 'none',
    borderBottom: active ? '1px solid var(--accent)' : '1px solid transparent',
    cursor: 'pointer',
  })

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 5 }}>WEBHOOKS</div>
        <h1 style={{ ...MONO, fontSize: 19, color: 'var(--text)', letterSpacing: '0.08em', marginBottom: 20 }}>MONITORING</h1>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          <button style={tabStyle(tab === 'dead-letters')} onClick={() => setTab('dead-letters')}>
            DEAD LETTERS
          </button>
          <button style={tabStyle(tab === 'misdirected')} onClick={() => setTab('misdirected')}>
            MISDIRECTED
          </button>
          <button style={tabStyle(tab === 'needs-review')} onClick={() => setTab('needs-review')}>
            NEEDS REVIEW
          </button>
        </div>
      </div>

      {tab === 'dead-letters' && (
        <>
          {dlError && (
            <p style={{ ...MONO, fontSize: 12, color: 'var(--red)', marginBottom: 16, letterSpacing: '0.08em' }}>
              {dlError.message}
            </p>
          )}
          <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                  {['CALLBACK URL', 'STATUS', 'ATTEMPTS', 'LAST ERROR', 'NEXT RETRY', 'CREATED'].map(h => (
                    <th key={h} style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(d => (
                  <tr key={d.ID} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '' }}
                  >
                    <td style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)', padding: '14px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.CallbackURL}>
                      {d.CallbackURL}
                    </td>
                    <td style={{ padding: '14px 14px' }}><StatusBadge status={d.Status} /></td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ marginBottom: 5 }}>
                        <span style={{ ...MONO, fontSize: 15, color: 'var(--text)' }}>{d.AttemptCount}</span>
                        <span style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)' }}>/{MAX_ATTEMPTS}</span>
                      </div>
                      <div style={{ height: 2, background: 'var(--border)', width: 48 }}>
                        <div style={{ height: 2, background: d.AttemptCount >= MAX_ATTEMPTS ? 'var(--red)' : '#D97706', width: `${Math.min((d.AttemptCount / MAX_ATTEMPTS) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px', maxWidth: 340 }}>
                      {d.LastError ? (
                        <div style={{ ...MONO, fontSize: 12, color: 'var(--red)', lineHeight: 1.55, padding: '5px 8px', background: 'var(--red-bg)', borderLeft: '2px solid var(--red)', wordBreak: 'break-word', maxHeight: 64, overflow: 'hidden' }} title={d.LastError}>
                          {d.LastError}
                        </div>
                      ) : <span style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                      {d.NextRetryAt ? (
                        <div>
                          <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 4 }}>SCHEDULED</div>
                          <div style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(d.NextRetryAt).toLocaleString()}</div>
                        </div>
                      ) : <span style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)', padding: '14px 14px', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                      {new Date(d.CreatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!dlLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '52px 16px', letterSpacing: '0.12em' }}>
                      NO DEAD LETTERS — ALL WEBHOOKS DELIVERED
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {dlLoading && <div style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', padding: '12px 14px', letterSpacing: '0.1em' }}>LOADING...</div>}
          </div>
        </>
      )}

      {tab === 'misdirected' && (
        <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                {['TXN REF', 'SIG VALID', 'ERROR', 'RECEIVED'].map(h => (
                  <th key={h} style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {misdirected.map(e => (
                <tr key={e.ID} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--surface-raised)' }}
                  onMouseLeave={ev => { ev.currentTarget.style.background = '' }}
                >
                  <td style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)', padding: '12px 14px' }}>
                    {e.NombaTxnRef ?? '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ ...MONO, fontSize: 11, letterSpacing: '0.1em', color: e.SignatureValid ? 'var(--green)' : 'var(--red)' }}>
                      {e.SignatureValid ? 'VALID' : 'INVALID'}
                    </span>
                  </td>
                  <td style={{ ...MONO, fontSize: 12, color: 'var(--red)', padding: '12px 14px', maxWidth: 340, wordBreak: 'break-word' }}>
                    {e.ErrorMessage ?? '—'}
                  </td>
                  <td style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {new Date(e.ReceivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!mdLoading && misdirected.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '52px 16px', letterSpacing: '0.12em' }}>
                    NO MISDIRECTED PAYMENTS
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {mdLoading && <div style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', padding: '12px 14px', letterSpacing: '0.1em' }}>LOADING...</div>}
        </div>
      )}

      {tab === 'needs-review' && (
        <>
          <p style={{ ...MONO, fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>
            PAYMENTS UNCONFIRMED AFTER 24H — NOT FOUND ON NOMBA AFTER REPEATED REQUERY. REQUIRES MANUAL INVESTIGATION.
          </p>
          <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                  {['TXN REF', 'AMOUNT', 'NARRATION', 'FLAGGED AT'].map(h => (
                    <th key={h} style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', padding: '10px 14px', textAlign: 'left', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {needsReview.map(e => (
                  <tr key={e.ID} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--surface-raised)' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = '' }}
                  >
                    <td style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)', padding: '12px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.NombaTxnRef}>
                      {e.NombaTxnRef}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ ...MONO, fontSize: 14, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        ₦{parseFloat(e.Amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ ...MONO, fontSize: 12, color: 'var(--text-muted)', padding: '12px 14px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.Narration ?? ''}>
                      {e.Narration ?? '—'}
                    </td>
                    <td style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {new Date(e.CreatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!nrLoading && needsReview.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '52px 16px', letterSpacing: '0.12em' }}>
                      NO PAYMENTS FLAGGED FOR REVIEW
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {nrLoading && <div style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', padding: '12px 14px', letterSpacing: '0.1em' }}>LOADING...</div>}
          </div>
        </>
      )}
    </div>
  )
}
