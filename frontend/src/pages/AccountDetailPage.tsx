import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Account, AccountsResponse, BankAccount, SettleResult } from '../api'
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
  const [showHistory, setShowHistory] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [renameError, setRenameError] = useState('')

  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payBankCode, setPayBankCode] = useState('')
  const [payAccountNumber, setPayAccountNumber] = useState('')
  const [payNarration, setPayNarration] = useState('')
  const [lookedUpAccount, setLookedUpAccount] = useState<BankAccount | null>(null)
  const [lookupErr, setLookupErr] = useState('')
  const [settleResult, setSettleResult] = useState<SettleResult | null>(null)
  const [settleErr, setSettleErr] = useState('')

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['account', accountRef],
    queryFn: () => api.accounts.get(accountRef!),
    enabled: !!accountRef,
    placeholderData: () => {
      const cached = queryClient.getQueryData<{ pages: AccountsResponse[] }>(['accounts'])
      return cached?.pages.flatMap(p => p.accounts ?? []).find(a => a.AccountRef === accountRef)
    },
  })

  const { data: balanceData } = useQuery({
    queryKey: ['account-balance', accountRef],
    queryFn: () => api.accounts.balance(accountRef!),
    enabled: !!accountRef,
  })

  const { data: historyData } = useQuery({
    queryKey: ['account-history', accountRef],
    queryFn: () => api.accounts.history(accountRef!),
    enabled: !!accountRef && showHistory,
  })

  const onSuccess = (updated: Account) => {
    queryClient.setQueryData(['account', accountRef], updated)
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
  }

  const expireMutation = useMutation({ mutationFn: () => api.accounts.expire(accountRef!), onSuccess })

  const renameMutation = useMutation({
    mutationFn: (name: string) => api.accounts.update(accountRef!, { name }),
    onSuccess: (updated) => {
      onSuccess(updated)
      setRenaming(false)
      setNameInput('')
      setRenameError('')
    },
    onError: (err: Error) => setRenameError(err.message),
  })

  const mutations: Record<LifecycleAction, typeof expireMutation> = {
    expire: expireMutation,
  }

  const acting = Object.values(mutations).some(m => m.isPending)
  const actionError = Object.values(mutations).find(m => m.error)?.error?.message

  const { data: banksData } = useQuery({
    queryKey: ['settlement-banks'],
    queryFn: () => api.settlement.listBanks(),
    staleTime: 5 * 60 * 1000,
    enabled: account?.Status === 'active',
  })

  const lookupMutation = useMutation({
    mutationFn: ({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) =>
      api.settlement.lookup(accountNumber, bankCode),
    onSuccess: (data) => { setLookedUpAccount(data); setLookupErr('') },
    onError: (err: Error) => { setLookedUpAccount(null); setLookupErr(err.message) },
  })

  const settleMutation = useMutation({
    mutationFn: () =>
      api.settlement.settle(accountRef!, payAmount, payBankCode, payAccountNumber, payNarration || undefined),
    onSuccess: (data) => {
      setSettleResult(data)
      setSettleErr('')
      setPayAmount('')
      setPayBankCode('')
      setPayAccountNumber('')
      setPayNarration('')
      setLookedUpAccount(null)
    },
    onError: (err: Error) => setSettleErr(err.message),
  })

  const handleAccountNumberChange = (val: string) => {
    setPayAccountNumber(val)
    setLookedUpAccount(null)
    setLookupErr('')
  }

  const triggerLookup = (accountNumber: string, bankCode: string) => {
    if (accountNumber.length === 10 && bankCode) {
      lookupMutation.mutate({ accountNumber, bankCode })
    }
  }

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

      <Link
        to="/accounts"
        style={{ ...MONO, fontSize: 10, color: '#888888', textDecoration: 'none', letterSpacing: '0.12em', display: 'inline-block', marginBottom: 28 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FFCD32' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#888888' }}
      >
        ← ACCOUNTS
      </Link>

      {/* Header */}
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

      {/* Balance chip */}
      {balanceData && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid #2A2A2A',
          padding: '10px 18px',
          marginBottom: 20,
        }}>
          <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#555' }}>BALANCE</span>
          <span style={{ ...MONO, fontSize: 18, color: '#FFCD32', letterSpacing: '0.04em' }}>
            ₦{Number(balanceData.balance).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* KV rows */}
      <div style={{ border: '1px solid #2A2A2A', marginBottom: 20 }}>
        {rows.map(([label, value, mono], i) => (
          <div key={label} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            padding: '10px 16px',
            borderBottom: i < rows.length - 1 ? '1px solid #1A1A1A' : 'none',
          }}>
            <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#888888', width: 140, flexShrink: 0, paddingTop: 1 }}>
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

      {/* Rename section */}
      {account.Status === 'active' && (
        <div style={{ marginBottom: 20 }}>
          {!renaming ? (
            <button
              onClick={() => { setRenaming(true); setNameInput(account.BankAccountName ?? '') }}
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: '0.12em',
                padding: '7px 16px',
                background: 'transparent',
                color: '#888888',
                border: '1px solid #2A2A2A',
                cursor: 'pointer',
              }}
            >
              RENAME ACCOUNT
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="New account name"
                style={{
                  ...MONO,
                  fontSize: 12,
                  background: '#0A0A0A',
                  border: '1px solid #3A3A3A',
                  color: '#C0C0C0',
                  padding: '7px 12px',
                  outline: 'none',
                  minWidth: 200,
                }}
              />
              <button
                onClick={() => renameMutation.mutate(nameInput)}
                disabled={renameMutation.isPending || !nameInput.trim()}
                style={{
                  ...MONO,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  padding: '7px 16px',
                  background: '#FFCD32',
                  color: '#0D0D0D',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: renameMutation.isPending ? 0.5 : 1,
                }}
              >
                {renameMutation.isPending ? '...' : 'SAVE'}
              </button>
              <button
                onClick={() => { setRenaming(false); setRenameError('') }}
                style={{
                  ...MONO,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  padding: '7px 14px',
                  background: 'transparent',
                  color: '#555',
                  border: '1px solid #2A2A2A',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
            </div>
          )}
          {renameError && (
            <p style={{ ...MONO, fontSize: 11, color: '#EF4444', marginTop: 8, letterSpacing: '0.06em' }}>
              {renameError}
            </p>
          )}
        </div>
      )}

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

      {/* Payout / settlement */}
      {account.Status === 'active' && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => { setPayoutOpen(v => !v); setSettleResult(null); setSettleErr('') }}
            style={{
              ...MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              padding: '8px 18px',
              background: 'transparent',
              color: '#FFCD32',
              border: '1px solid #3A3A1A',
              cursor: 'pointer',
            }}
          >
            {payoutOpen ? 'CLOSE PAYOUT' : 'INITIATE PAYOUT'}
          </button>

          {payoutOpen && (
            <div style={{ marginTop: 12, border: '1px solid #2A2A2A', padding: '20px 20px 20px' }}>
              <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.18em', color: '#555', marginBottom: 18 }}>
                SETTLEMENT
              </div>

              {settleResult ? (
                <div>
                  <div style={{ ...MONO, fontSize: 11, color: '#22c55e', letterSpacing: '0.08em', marginBottom: 14 }}>
                    QUEUED ✓
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                    <div>
                      <div style={{ ...MONO, fontSize: 9, color: '#555', letterSpacing: '0.12em', marginBottom: 3 }}>MERCHANT REF</div>
                      <div style={{ ...MONO, fontSize: 12, color: '#C0C0C0', letterSpacing: '0.06em' }}>{settleResult.merchantTxRef}</div>
                    </div>
                    <div>
                      <div style={{ ...MONO, fontSize: 9, color: '#555', letterSpacing: '0.12em', marginBottom: 3 }}>AMOUNT</div>
                      <div style={{ ...MONO, fontSize: 16, color: '#FFCD32' }}>
                        ₦{Number(settleResult.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettleResult(null)}
                    style={{
                      ...MONO,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      padding: '7px 14px',
                      background: 'transparent',
                      color: '#888',
                      border: '1px solid #2A2A2A',
                      cursor: 'pointer',
                    }}
                  >
                    NEW PAYOUT
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>

                  {/* Bank */}
                  <div>
                    <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#888', marginBottom: 6 }}>BANK</div>
                    <select
                      value={payBankCode}
                      onChange={e => {
                        const code = e.target.value
                        setPayBankCode(code)
                        setLookedUpAccount(null)
                        setLookupErr('')
                        triggerLookup(payAccountNumber, code)
                      }}
                      style={{
                        ...MONO,
                        fontSize: 12,
                        background: '#0A0A0A',
                        border: '1px solid #3A3A3A',
                        color: payBankCode ? '#C0C0C0' : '#555',
                        padding: '7px 12px',
                        outline: 'none',
                        width: '100%',
                      }}
                    >
                      <option value="">Select bank...</option>
                      {(banksData?.banks ?? []).map(b => (
                        <option key={b.Code} value={b.Code}>{b.Name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Account number */}
                  <div>
                    <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#888', marginBottom: 6 }}>ACCOUNT NUMBER</div>
                    <input
                      type="text"
                      value={payAccountNumber}
                      maxLength={10}
                      onChange={e => handleAccountNumberChange(e.target.value.replace(/\D/g, ''))}
                      onBlur={() => triggerLookup(payAccountNumber, payBankCode)}
                      placeholder="10 digits"
                      style={{
                        ...MONO,
                        fontSize: 12,
                        background: '#0A0A0A',
                        border: '1px solid #3A3A3A',
                        color: '#C0C0C0',
                        padding: '7px 12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    {lookupMutation.isPending && (
                      <div style={{ ...MONO, fontSize: 10, color: '#555', marginTop: 4 }}>verifying...</div>
                    )}
                    {lookedUpAccount && (
                      <div style={{ ...MONO, fontSize: 11, color: '#22c55e', marginTop: 4, letterSpacing: '0.06em' }}>
                        ✓ {lookedUpAccount.AccountName}
                      </div>
                    )}
                    {lookupErr && (
                      <div style={{ ...MONO, fontSize: 11, color: '#EF4444', marginTop: 4 }}>{lookupErr}</div>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#888', marginBottom: 6 }}>AMOUNT (NGN)</div>
                    <input
                      type="text"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder="e.g. 5000.00"
                      style={{
                        ...MONO,
                        fontSize: 12,
                        background: '#0A0A0A',
                        border: '1px solid #3A3A3A',
                        color: '#C0C0C0',
                        padding: '7px 12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Narration */}
                  <div>
                    <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#888', marginBottom: 6 }}>
                      NARRATION <span style={{ color: '#444' }}>(optional)</span>
                    </div>
                    <input
                      type="text"
                      value={payNarration}
                      onChange={e => setPayNarration(e.target.value)}
                      placeholder="Transfer description"
                      style={{
                        ...MONO,
                        fontSize: 12,
                        background: '#0A0A0A',
                        border: '1px solid #3A3A3A',
                        color: '#C0C0C0',
                        padding: '7px 12px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {settleErr && (
                    <p style={{ ...MONO, fontSize: 11, color: '#EF4444', letterSpacing: '0.06em' }}>{settleErr}</p>
                  )}

                  <button
                    onClick={() => settleMutation.mutate()}
                    disabled={!lookedUpAccount || !payAmount || !payBankCode || settleMutation.isPending}
                    style={{
                      ...MONO,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      padding: '9px 20px',
                      background: (lookedUpAccount && payAmount && payBankCode) ? '#FFCD32' : '#1A1A1A',
                      color: (lookedUpAccount && payAmount && payBankCode) ? '#0D0D0D' : '#444',
                      border: 'none',
                      cursor: (lookedUpAccount && payAmount && payBankCode && !settleMutation.isPending) ? 'pointer' : 'not-allowed',
                      opacity: settleMutation.isPending ? 0.5 : 1,
                      width: 'fit-content',
                    }}
                  >
                    {settleMutation.isPending ? 'QUEUING...' : 'CONFIRM & SETTLE'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
          marginRight: 10,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFCD32' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3A3A1A' }}
      >
        VIEW STATEMENT →
      </Link>

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(v => !v)}
        style={{
          ...MONO,
          fontSize: 10,
          letterSpacing: '0.12em',
          padding: '9px 20px',
          background: 'transparent',
          color: '#888888',
          border: '1px solid #2A2A2A',
          cursor: 'pointer',
        }}
      >
        {showHistory ? 'HIDE HISTORY' : 'VIEW HISTORY'}
      </button>

      {/* State history */}
      {showHistory && (
        <div style={{ marginTop: 24, borderLeft: '2px solid #2A2A2A', paddingLeft: 20 }}>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: '#555', marginBottom: 16 }}>
            ACCOUNT STATE HISTORY
          </div>
          {(historyData?.history ?? []).length === 0 ? (
            <span style={{ ...MONO, fontSize: 11, color: '#555' }}>No history yet.</span>
          ) : (
            (historyData?.history ?? []).map(entry => (
              <div key={entry.ID} style={{ display: 'flex', gap: 16, marginBottom: 14, alignItems: 'flex-start' }}>
                <div style={{ ...MONO, fontSize: 10, color: '#555', whiteSpace: 'nowrap', paddingTop: 1 }}>
                  {new Date(entry.CreatedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div>
                  <div style={{ ...MONO, fontSize: 11, color: '#C0C0C0', letterSpacing: '0.06em' }}>
                    {entry.FromStatus ? `${entry.FromStatus.toUpperCase()} → ` : ''}{entry.ToStatus.toUpperCase()}
                  </div>
                  {entry.Reason && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{entry.Reason}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
