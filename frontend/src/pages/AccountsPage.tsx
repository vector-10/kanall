import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { AccountsResponse } from '../api'
import StatusBadge from '../components/StatusBadge'

const emptyForm = { externalRef: '', name: '', bvn: '', callbackUrl: '', expectedAmount: '' }

const MONO = { fontFamily: 'var(--font-mono)' }

const LABEL_STYLE = {
  ...MONO,
  display: 'block',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: '#555',
  marginBottom: 6,
} as const

const INPUT_BASE = {
  ...MONO,
  width: '100%',
  background: '#0A0A0A',
  border: '1px solid #2A2A2A',
  padding: '8px 12px',
  fontSize: 12,
  color: '#F5F5F5',
  outline: 'none',
} as const

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['accounts'],
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        api.accounts.list(pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: AccountsResponse) =>
        last.pagination.hasMore && last.pagination.nextCursor
          ? last.pagination.nextCursor
          : undefined,
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

  const submit = () => {
    createMutation.mutate({
      externalRef: form.externalRef,
      name: form.name,
      bvn: form.bvn || undefined,
      callbackUrl: form.callbackUrl || undefined,
      expectedAmount: form.expectedAmount ? parseFloat(form.expectedAmount) : undefined,
    })
  }

  const field = (key: keyof typeof form, label: string, placeholder: string, required = false, type = 'text') => (
    <div key={key}>
      <label style={LABEL_STYLE}>{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        required={required}
        style={INPUT_BASE}
        onFocus={e => { e.currentTarget.style.borderColor = '#FFCD32' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#2A2A2A' }}
      />
    </div>
  )

  return (
    <div style={{ padding: '32px 28px', maxWidth: 980 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: '#666', marginBottom: 5 }}>
            DASHBOARD
          </div>
          <h1 style={{ ...MONO, fontSize: 17, color: '#F5F5F5', letterSpacing: '0.08em' }}>
            VIRTUAL ACCOUNTS
          </h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            ...MONO,
            fontSize: 10,
            letterSpacing: '0.12em',
            padding: '8px 16px',
            background: showForm ? 'transparent' : '#FFCD32',
            color: showForm ? '#555' : '#0D0D0D',
            border: showForm ? '1px solid #2A2A2A' : 'none',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'CANCEL' : '+ NEW ACCOUNT'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); submit() }}
          style={{
            background: '#111',
            border: '1px solid #2A2A2A',
            borderBottom: 'none',
            padding: '20px 22px',
            marginBottom: 0,
          }}
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
            <p style={{ ...MONO, fontSize: 11, color: '#ef4444', marginBottom: 12, letterSpacing: '0.06em' }}>
              {createMutation.error.message}
            </p>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{
              ...MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              padding: '9px 20px',
              background: '#FFCD32',
              color: '#0D0D0D',
              border: 'none',
              cursor: 'pointer',
              opacity: createMutation.isPending ? 0.5 : 1,
            }}
          >
            {createMutation.isPending ? 'CREATING...' : 'CREATE ACCOUNT →'}
          </button>
        </form>
      )}

      {error && (
        <p style={{ ...MONO, fontSize: 11, color: '#ef4444', marginBottom: 16, letterSpacing: '0.06em' }}>
          {error.message}
        </p>
      )}

      {/* Table */}
      <div style={{ border: '1px solid #2A2A2A', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2A2A2A', background: '#0A0A0A' }}>
              {['ACCOUNT REF', 'NUBAN', 'NAME', 'STATUS', 'CREATED'].map(h => (
                <th
                  key={h}
                  style={{
                    ...MONO,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: '#888888',
                    padding: '10px 16px',
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
            {accounts.map(a => (
              <tr
                key={a.ID}
                style={{ borderBottom: '1px solid #1A1A1A' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                <td style={{ padding: '11px 16px' }}>
                  <Link
                    to={`/accounts/${a.AccountRef}`}
                    style={{
                      ...MONO,
                      fontSize: 12,
                      color: '#FFCD32',
                      textDecoration: 'none',
                      letterSpacing: '0.04em',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    {a.AccountRef}
                  </Link>
                </td>
                <td style={{ ...MONO, fontSize: 12, color: '#888888', padding: '11px 16px', letterSpacing: '0.06em' }}>
                  {a.BankAccountNumber ?? '—'}
                </td>
                <td style={{ fontSize: 12, color: '#B0B0B0', padding: '11px 16px', fontFamily: 'var(--font-sans)' }}>
                  {a.BankAccountName ?? '—'}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <StatusBadge status={a.Status} />
                </td>
                <td style={{ ...MONO, fontSize: 10, color: '#888888', padding: '11px 16px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {new Date(a.CreatedAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {!isLoading && accounts.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    ...MONO,
                    fontSize: 11,
                    color: '#555555',
                    textAlign: 'center',
                    padding: '52px 16px',
                    letterSpacing: '0.12em',
                  }}
                >
                  NO ACCOUNTS — CREATE ONE ABOVE
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {isLoading && (
          <div style={{ ...MONO, fontSize: 11, color: '#3A3A3A', padding: '12px 16px', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        )}

        {hasNextPage && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #2A2A2A' }}>
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
