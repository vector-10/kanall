import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { AccountsResponse } from '../api'
import StatusBadge from '../components/StatusBadge'

const emptyForm = { externalRef: '', name: '', bvn: '', callbackUrl: '', expectedAmount: '' }
const MONO = { fontFamily: 'var(--font-mono)' }

const inputStyle: React.CSSProperties = {
  ...MONO,
  width: '100%',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  ...MONO,
  display: 'block',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--text-muted)',
  marginBottom: 6,
}

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['accounts'],
      queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.accounts.list(pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: AccountsResponse) =>
        last.pagination.hasMore && last.pagination.nextCursor ? last.pagination.nextCursor : undefined,
    })

  const accounts = data?.pages.flatMap(p => p.accounts ?? []) ?? []

  const createMutation = useMutation({
    mutationFn: api.accounts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setShowForm(false)
      setForm(emptyForm)
    },
  })

  const field = (key: keyof typeof form, label: string, placeholder: string, required = false, type = 'text') => (
    <div key={key}>
      <label style={labelStyle}>{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      />
    </div>
  )

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 4 }}>DASHBOARD</div>
          <h1 style={{ ...MONO, fontSize: 17, color: 'var(--text)', letterSpacing: '0.08em' }}>VIRTUAL ACCOUNTS</h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '9px 18px',
            background: showForm ? 'transparent' : 'var(--accent)',
            color: showForm ? 'var(--text-muted)' : 'var(--accent-fg)',
            border: showForm ? '1px solid var(--border)' : 'none',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'CANCEL' : '+ NEW ACCOUNT'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMutation.mutate({ externalRef: form.externalRef, name: form.name, bvn: form.bvn || undefined, callbackUrl: form.callbackUrl || undefined, expectedAmount: form.expectedAmount ? parseFloat(form.expectedAmount) : undefined }) }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none', padding: '22px 24px', marginBottom: 0 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {field('externalRef', 'EXTERNAL REF', 'your-internal-id', true)}
            {field('name', 'ACCOUNT NAME', 'Jane Doe', true)}
            {field('bvn', 'BVN', '22123456789')}
            {field('callbackUrl', 'CALLBACK URL', 'https://…')}
          </div>
          <div style={{ width: '50%', marginBottom: 16 }}>
            {field('expectedAmount', 'EXPECTED AMOUNT (NGN)', '5000.00', false, 'number')}
          </div>
          {createMutation.error && (
            <p style={{ ...MONO, fontSize: 11, color: 'var(--red)', marginBottom: 12, letterSpacing: '0.06em' }}>
              {createMutation.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '9px 20px', background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', cursor: 'pointer', opacity: createMutation.isPending ? 0.5 : 1 }}
          >
            {createMutation.isPending ? 'CREATING...' : 'CREATE ACCOUNT →'}
          </button>
        </form>
      )}

      {error && (
        <p style={{ ...MONO, fontSize: 11, color: 'var(--red)', marginBottom: 16 }}>{error.message}</p>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
              {['NUBAN', 'ACCOUNT NAME', 'BANK', 'STATUS', 'CREATED', ''].map(h => (
                <th key={h} style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr
                key={a.ID}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                <td style={{ ...MONO, fontSize: 12, color: 'var(--text)', padding: '12px 16px', letterSpacing: '0.06em' }}>
                  {a.BankAccountNumber ?? '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text)', padding: '12px 16px', fontFamily: 'var(--font-sans)' }}>
                  {a.BankAccountName ?? '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 16px' }}>
                  {a.BankName ?? '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={a.Status} />
                </td>
                <td style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)', padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  {new Date(a.CreatedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => navigate(`/accounts/${a.AccountRef}`)}
                    style={{
                      ...MONO, fontSize: 10, letterSpacing: '0.1em',
                      padding: '6px 14px',
                      background: 'transparent',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,205,50,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    DETAILS →
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && accounts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '52px 16px', letterSpacing: '0.12em' }}>
                  NO ACCOUNTS — CREATE ONE ABOVE
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {isLoading && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)', padding: '12px 16px', letterSpacing: '0.1em' }}>LOADING...</div>
        )}

        {hasNextPage && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', opacity: isFetchingNextPage ? 0.5 : 1 }}
            >
              {isFetchingNextPage ? 'LOADING...' : 'LOAD MORE →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
