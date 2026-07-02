import { useParams, Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Statement } from '../api'
import StatusBadge from '../components/StatusBadge'

function ngn(amount: string) {
  return parseFloat(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

const MONO = { fontFamily: 'var(--font-mono)' }

const COLS: [string, 'left' | 'right'][] = [
  ['DIR',       'left'],
  ['AMOUNT',    'right'],
  ['FEE',       'right'],
  ['BALANCE',   'right'],
  ['STATUS',    'left'],
  ['NARRATION', 'left'],
  ['DATE',      'left'],
]

export default function StatementPage() {
  const { accountRef } = useParams<{ accountRef: string }>()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['statement', accountRef],
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        api.accounts.statement(accountRef!, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: Statement) =>
        last.pagination.hasMore && last.pagination.nextCursor
          ? last.pagination.nextCursor
          : undefined,
      enabled: !!accountRef,
    })

  const summary = data?.pages[0]
  const lines = data?.pages.flatMap(p => p.lines) ?? []

  if (isLoading) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: '#888888', letterSpacing: '0.12em' }}>
      LOADING...
    </div>
  )
  if (error) return (
    <div style={{ ...MONO, padding: 28, fontSize: 11, color: '#EF4444', letterSpacing: '0.1em' }}>
      {error.message}
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 980 }}>

      {/* Breadcrumb */}
      <Link
        to={`/accounts/${accountRef}`}
        style={{
          ...MONO,
          fontSize: 10,
          color: '#888888',
          textDecoration: 'none',
          letterSpacing: '0.12em',
          display: 'inline-block',
          marginBottom: 28,
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FFCD32' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#888888' }}
      >
        ← {accountRef}
      </Link>

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
          {accountRef}
        </div>
        <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em' }}>STATEMENT</h1>
      </div>

      {/* Summary stat row */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginBottom: 24, background: '#2A2A2A' }}>
          {([
            ['TOTAL CREDITS',   summary.totalCredits,    '#FFCD32'],
            ['TOTAL DEBITS',    summary.totalDebits,     '#EF4444'],
            ['CLOSING BALANCE', summary.closingBalance,  '#F5F5F5'],
            ['OPENING BALANCE', summary.openingBalance,  '#5A5A5A'],
          ] as [string, string, string][]).map(([label, value, color]) => (
            <div key={label} style={{ background: '#111', padding: '14px 16px' }}>
              <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#888888', marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ ...MONO, fontSize: 14, color, fontWeight: 500 }}>
                NGN {ngn(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ledger table */}
      <div style={{ border: '1px solid #2A2A2A', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2A', background: '#0A0A0A' }}>
              {COLS.map(([h, align]) => (
                <th
                  key={h}
                  style={{
                    ...MONO,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: '#888888',
                    padding: '10px 14px',
                    textAlign: align,
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(({ entry, runningBalance }) => {
              const isCredit = entry.Direction === 'credit'
              const amtColor = isCredit ? '#FFCD32' : '#EF4444'
              return (
                <tr
                  key={entry.ID}
                  style={{ borderBottom: '1px solid #1A1A1A' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0F0F0F' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  {/* Direction */}
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: amtColor }}>
                      {entry.Direction.toUpperCase()}
                    </span>
                  </td>

                  {/* Amount */}
                  <td style={{ ...MONO, fontSize: 12, color: amtColor, padding: '10px 14px', textAlign: 'right' }}>
                    {isCredit ? '+' : '-'}{ngn(entry.Amount)}
                  </td>

                  {/* Fee */}
                  <td style={{ ...MONO, fontSize: 11, color: '#888888', padding: '10px 14px', textAlign: 'right' }}>
                    {parseFloat(entry.Fee) > 0 ? ngn(entry.Fee) : '—'}
                  </td>

                  {/* Running balance */}
                  <td style={{ ...MONO, fontSize: 12, color: '#888888', padding: '10px 14px', textAlign: 'right' }}>
                    {ngn(runningBalance)}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '10px 14px' }}>
                    <StatusBadge status={entry.Status} />
                  </td>

                  {/* Narration */}
                  <td
                    style={{
                      fontSize: 11,
                      color: '#888888',
                      padding: '10px 14px',
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)',
                    }}
                    title={entry.Narration ?? ''}
                  >
                    {entry.Narration ?? '—'}
                  </td>

                  {/* Date */}
                  <td style={{ ...MONO, fontSize: 10, color: '#888888', padding: '10px 14px', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
                    {new Date(entry.CreatedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              )
            })}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...MONO,
                    fontSize: 11,
                    color: '#555555',
                    textAlign: 'center',
                    padding: '52px 16px',
                    letterSpacing: '0.12em',
                  }}
                >
                  NO ENTRIES YET
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {hasNextPage && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #2A2A2A' }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                color: '#FFCD32',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                opacity: isFetchingNextPage ? 0.5 : 1,
              }}
            >
              {isFetchingNextPage ? 'LOADING...' : 'LOAD MORE →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
