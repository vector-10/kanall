import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { CustomersResponse } from '../api'

const MONO = { fontFamily: 'var(--font-mono)' }

const TIER_COLORS: Record<number, { color: string; bg: string; border: string }> = {
  1: { color: '#888888', bg: 'rgba(136,136,136,0.08)', border: 'rgba(136,136,136,0.2)' },
  2: { color: '#FFCD32', bg: 'rgba(255,205,50,0.08)', border: 'rgba(255,205,50,0.2)' },
  3: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
}

function TierBadge({ tier }: { tier: number }) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS[1]
  return (
    <span style={{
      ...MONO,
      fontSize: 9,
      letterSpacing: '0.1em',
      color: c.color,
      background: c.bg,
      border: `1px solid ${c.border}`,
      padding: '2px 8px',
    }}>
      TIER {tier}
    </span>
  )
}

export default function CustomersPage() {
  const [hoveredID, setHoveredID] = useState<string | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['customers'],
    queryFn: ({ pageParam }) => api.customers.list(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: CustomersResponse) =>
      last.pagination.hasMore ? (last.pagination.nextCursor ?? undefined) : undefined,
  })

  const customers = data?.pages.flatMap(p => p.customers) ?? []

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

  return (
    <div style={{ padding: '32px 28px' }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
        DASHBOARD
      </div>
      <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em', marginBottom: 32 }}>
        CUSTOMERS
      </h1>

      {customers.length === 0 ? (
        <div style={{ ...MONO, fontSize: 12, color: '#555', letterSpacing: '0.06em', paddingTop: 20 }}>
          No customers yet. Provision a virtual account to create a customer.
        </div>
      ) : (
        <div style={{ border: '1px solid #2A2A2A' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 80px 100px',
            gap: 16,
            padding: '8px 16px',
            borderBottom: '1px solid #2A2A2A',
          }}>
            {['NAME', 'EXTERNAL REF', 'KYC TIER', 'STATUS'].map(h => (
              <span key={h} style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#555' }}>{h}</span>
            ))}
          </div>

          {customers.map((c, i) => (
            <Link
              key={c.ID}
              to={`/customers/${c.ID}`}
              style={{ textDecoration: 'none' }}
              onMouseEnter={() => setHoveredID(c.ID)}
              onMouseLeave={() => setHoveredID(null)}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 80px 100px',
                gap: 16,
                padding: '12px 16px',
                borderBottom: i < customers.length - 1 ? '1px solid #1A1A1A' : 'none',
                background: hoveredID === c.ID ? 'rgba(255,205,50,0.03)' : 'transparent',
                transition: 'background 0.1s',
              }}>
                <span style={{ ...MONO, fontSize: 12, color: '#C0C0C0', letterSpacing: '0.04em' }}>
                  {c.Name}
                </span>
                <span style={{ ...MONO, fontSize: 11, color: '#666', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.ExternalRef}
                </span>
                <TierBadge tier={c.KYCTier} />
                <span style={{ ...MONO, fontSize: 10, color: c.Status === 'active' ? '#22c55e' : '#888', letterSpacing: '0.1em' }}>
                  {c.Status.toUpperCase()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={{
            ...MONO,
            marginTop: 20,
            fontSize: 10,
            letterSpacing: '0.12em',
            padding: '8px 20px',
            background: 'transparent',
            color: '#888',
            border: '1px solid #2A2A2A',
            cursor: 'pointer',
          }}
        >
          {isFetchingNextPage ? 'LOADING...' : 'LOAD MORE'}
        </button>
      )}
    </div>
  )
}
