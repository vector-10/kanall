import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'

const MAX_ATTEMPTS = 5
const MONO = { fontFamily: 'var(--font-mono)' }

export default function DeadLettersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dead-letters'],
    queryFn: api.deadLetters,
  })

  const items = data?.deadLetters ?? []

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
          WEBHOOKS
        </div>
        <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em' }}>
          DEAD LETTERS
        </h1>
      </div>

      {error && (
        <p style={{ ...MONO, fontSize: 11, color: '#EF4444', marginBottom: 16, letterSpacing: '0.08em' }}>
          {error.message}
        </p>
      )}

      <div style={{ border: '1px solid #2A2A2A', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2A', background: '#0A0A0A' }}>
              {['CALLBACK URL', 'STATUS', 'ATTEMPTS', 'LAST ERROR', 'NEXT RETRY', 'CREATED'].map(h => (
                <th
                  key={h}
                  style={{
                    ...MONO,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: '#888888',
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr
                key={d.ID}
                style={{ borderBottom: '1px solid #1A1A1A' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0F0F0F' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                {/* Callback URL */}
                <td
                  style={{
                    ...MONO,
                    fontSize: 11,
                    color: '#888888',
                    padding: '14px 14px',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={d.CallbackURL}
                >
                  {d.CallbackURL}
                </td>

                {/* Status */}
                <td style={{ padding: '14px 14px' }}>
                  <StatusBadge status={d.Status} />
                </td>

                {/* Attempts */}
                <td style={{ padding: '14px 14px' }}>
                  <div style={{ marginBottom: 5 }}>
                    <span style={{ ...MONO, fontSize: 14, color: '#F5F5F5' }}>{d.AttemptCount}</span>
                    <span style={{ ...MONO, fontSize: 10, color: '#888888' }}>/{MAX_ATTEMPTS}</span>
                  </div>
                  <div style={{ height: 2, background: '#2A2A2A', width: 48 }}>
                    <div
                      style={{
                        height: 2,
                        background: d.AttemptCount >= MAX_ATTEMPTS ? '#EF4444' : '#D97706',
                        width: `${Math.min((d.AttemptCount / MAX_ATTEMPTS) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </td>

                {/* Last Error — hero column */}
                <td style={{ padding: '14px 14px', maxWidth: 340 }}>
                  {d.LastError ? (
                    <div
                      style={{
                        ...MONO,
                        fontSize: 11,
                        color: '#FC8181',
                        lineHeight: 1.55,
                        padding: '5px 8px',
                        background: 'rgba(239,68,68,0.05)',
                        borderLeft: '2px solid #7F1D1D',
                        wordBreak: 'break-word',
                        maxHeight: 64,
                        overflow: 'hidden',
                      }}
                      title={d.LastError}
                    >
                      {d.LastError}
                    </div>
                  ) : (
                    <span style={{ ...MONO, fontSize: 11, color: '#555555' }}>—</span>
                  )}
                </td>

                {/* Next Retry */}
                <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                  {d.NextRetryAt ? (
                    <div>
                      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#FFCD32', marginBottom: 4 }}>
                        SCHEDULED
                      </div>
                      <div style={{ ...MONO, fontSize: 11, color: '#888888' }}>
                        {new Date(d.NextRetryAt).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <span style={{ ...MONO, fontSize: 11, color: '#555555' }}>—</span>
                  )}
                </td>

                {/* Created */}
                <td style={{ ...MONO, fontSize: 10, color: '#888888', padding: '14px 14px', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                  {new Date(d.CreatedAt).toLocaleString()}
                </td>
              </tr>
            ))}

            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    ...MONO,
                    fontSize: 11,
                    color: '#555555',
                    textAlign: 'center',
                    padding: '52px 16px',
                    letterSpacing: '0.12em',
                  }}
                >
                  NO DEAD LETTERS — ALL WEBHOOKS DELIVERED
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {isLoading && (
          <div style={{ ...MONO, fontSize: 11, color: '#888888', padding: '12px 14px', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        )}
      </div>
    </div>
  )
}
