import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Account, AccountsResponse } from '../api'
import StatusBadge from '../components/StatusBadge'

type LifecycleAction = 'expire'

interface ActionDef {
  action: LifecycleAction
  label: string
  color: string
  borderColor: string
  filled?: boolean
}

const ACTIONS: Record<string, ActionDef[]> = {
  active:  [{ action: 'expire', label: 'EXPIRE', color: '#EF4444', borderColor: '#7F1D1D' }],
  expired: [],
}

const MONO = { fontFamily: 'var(--font-mono)' }

export default function AccountDetailPage() {
  const { accountRef } = useParams<{ accountRef: string }>()
  const queryClient = useQueryClient()

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['account', accountRef],
    queryFn: () => api.accounts.get(accountRef!),
    enabled: !!accountRef,
    placeholderData: () => {
      const cached = queryClient.getQueryData<{ pages: AccountsResponse[] }>(['accounts'])
      return cached?.pages.flatMap(p => p.accounts).find(a => a.AccountRef === accountRef)
    },
  })

  const onSuccess = (updated: Account) => {
    queryClient.setQueryData(['account', accountRef], updated)
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
  }

  const expireMutation = useMutation({ mutationFn: () => api.accounts.expire(accountRef!), onSuccess })

  const mutations: Record<LifecycleAction, typeof expireMutation> = {
    expire: expireMutation,
  }

  const acting = Object.values(mutations).some(m => m.isPending)
  const actionError = Object.values(mutations).find(m => m.error)?.error?.message

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
  if (!account) return null

  const actions = ACTIONS[account.Status] ?? []

  const rows: [string, string | null, boolean?][] = [
    ['NUBAN',           account.BankAccountNumber, true],
    ['BANK',            account.BankName],
    ['ACCOUNT NAME',    account.BankAccountName],
    ['CURRENCY',        account.Currency],
    ['CALLBACK URL',    account.CallbackURL, true],
    ['EXPECTED AMOUNT', account.ExpectedAmount ? `NGN ${account.ExpectedAmount}` : null, true],
    ['CREATED',         new Date(account.CreatedAt).toLocaleString()],
  ]

  return (
    <div style={{ padding: '32px 28px', maxWidth: 660 }}>

      {/* Breadcrumb */}
      <Link
        to="/accounts"
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
        ← ACCOUNTS
      </Link>

      {/* Account header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ ...MONO, fontSize: 20, color: '#FFCD32', letterSpacing: '0.06em', marginBottom: 6 }}>
            {account.AccountRef}
          </h1>
          <span style={{ ...MONO, fontSize: 9, color: '#888888', letterSpacing: '0.16em' }}>
            {account.Provider.toUpperCase()}
          </span>
        </div>
        <StatusBadge status={account.Status} />
      </div>

      {/* Terminal KV rows */}
      <div style={{ border: '1px solid #2A2A2A', marginBottom: 20 }}>
        {rows.map(([label, value, mono], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 20,
              padding: '10px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid #1A1A1A' : 'none',
            }}
          >
            <span style={{
              ...MONO,
              fontSize: 9,
              letterSpacing: '0.14em',
              color: '#888888',
              width: 140,
              flexShrink: 0,
              paddingTop: 1,
            }}>
              {label}
            </span>
            <span style={{
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: 12,
              color: value ? '#C0C0C0' : '#555555',
              letterSpacing: mono ? '0.06em' : 0,
              wordBreak: 'break-all',
            }}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Lifecycle buttons */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {actions.map(btn => (
            <button
              key={btn.action}
              onClick={() => mutations[btn.action].mutate()}
              disabled={acting}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '8px 18px',
                background: btn.filled ? '#FFCD32' : 'transparent',
                color: btn.filled ? '#0D0D0D' : btn.color,
                border: `1px solid ${btn.borderColor}`,
                cursor: acting ? 'not-allowed' : 'pointer',
                opacity: acting ? 0.5 : 1,
              }}
            >
              {mutations[btn.action].isPending ? '...' : btn.label}
            </button>
          ))}
        </div>
      )}

      {actionError && (
        <p style={{ ...MONO, fontSize: 11, color: '#EF4444', marginBottom: 18, letterSpacing: '0.08em' }}>
          {actionError}
        </p>
      )}

      {/* View Statement */}
      <Link
        to={`/accounts/${accountRef}/statement`}
        style={{
          ...MONO,
          fontSize: 10,
          letterSpacing: '0.12em',
          color: '#FFCD32',
          textDecoration: 'none',
          border: '1px solid #3A3A1A',
          padding: '9px 20px',
          display: 'inline-block',
          background: 'rgba(255,205,50,0.04)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFCD32' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3A3A1A' }}
      >
        VIEW STATEMENT →
      </Link>
    </div>
  )
}
