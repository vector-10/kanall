import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { CustomersResponse } from '../api'

const MONO = { fontFamily: 'var(--font-mono)' }

const TIER_COLORS: Record<number, { color: string; bg: string; border: string }> = {
  1: { color: '#888888', bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.25)' },
  2: { color: '#FFCD32', bg: 'rgba(255,205,50,0.08)', border: 'rgba(255,205,50,0.25)' },
  3: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' },
}

function TierBadge({ tier }: { tier: number }) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS[1]
  return (
    <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: '2px 8px' }}>
      TIER {tier}
    </span>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['customers'],
      queryFn: ({ pageParam }) => api.customers.list(pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: CustomersResponse) =>
        last.pagination.hasMore ? (last.pagination.nextCursor ?? undefined) : undefined,
    })

  const customers = data?.pages.flatMap(p => p.customers ?? []) ?? []

  if (isLoading) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.12em' }}>LOADING...</div>
  )
  if (error) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: 'var(--red)', letterSpacing: '0.1em' }}>{(error as Error).message}</div>
  )

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 5 }}>DASHBOARD</div>
      <h1 style={{ ...MONO, fontSize: 17, color: 'var(--text)', letterSpacing: '0.08em', marginBottom: 32 }}>CUSTOMERS</h1>

      {customers.length === 0 ? (
        <div style={{ ...MONO, fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.06em', paddingTop: 20 }}>
          No customers yet. Provision a virtual account to create a customer.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                {['NAME', 'EXTERNAL REF', 'KYC TIER', 'STATUS', ''].map(h => (
                  <th key={h} style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr
                  key={c.ID}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ ...MONO, fontSize: 12, color: 'var(--text)', padding: '12px 16px', letterSpacing: '0.04em' }}>
                    {c.Name}
                  </td>
                  <td style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 16px', letterSpacing: '0.04em', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ExternalRef}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <TierBadge tier={c.KYCTier} />
                  </td>
                  <td style={{ ...MONO, fontSize: 10, color: c.Status === 'active' ? '#22c55e' : 'var(--text-muted)', padding: '12px 16px', letterSpacing: '0.1em' }}>
                    {c.Status.toUpperCase()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/customers/${c.ID}`)}
                      style={{ ...MONO, fontSize: 10, letterSpacing: '0.1em', padding: '6px 14px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,205,50,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      DETAILS →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={{ ...MONO, marginTop: 20, fontSize: 10, letterSpacing: '0.12em', padding: '8px 20px', background: 'transparent', color: 'var(--accent)', border: 'none', cursor: 'pointer', opacity: isFetchingNextPage ? 0.5 : 1 }}
        >
          {isFetchingNextPage ? 'LOADING...' : 'LOAD MORE →'}
        </button>
      )}
    </div>
  )
}
