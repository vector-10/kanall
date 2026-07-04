import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Account, AccountsResponse, BankAccount, SettleResult } from '../api'
import StatusBadge from '../components/StatusBadge'

const MONO = { fontFamily: 'var(--font-mono)' }

const btn = (variant: 'primary' | 'danger' | 'ghost' | 'outline'): React.CSSProperties => {
  const base: React.CSSProperties = { ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', border: 'none', cursor: 'pointer' }
  if (variant === 'primary') return { ...base, background: 'var(--accent)', color: 'var(--accent-fg)' }
  if (variant === 'danger')  return { ...base, background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)' }
  if (variant === 'ghost')   return { ...base, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  return { ...base, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }
}

const inputStyle: React.CSSProperties = {
  ...MONO, fontSize: 12, width: '100%',
  background: 'var(--surface-raised)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '8px 12px', outline: 'none', boxSizing: 'border-box',
}

export default function AccountDetailPage() {
  const { accountRef } = useParams<{ accountRef: string }>()
  const queryClient = useQueryClient()

  // UI state
  const [showHistory, setShowHistory]         = useState(false)
  const [renaming, setRenaming]               = useState(false)
  const [nameInput, setNameInput]             = useState('')
  const [renameError, setRenameError]         = useState('')
  const [showExpireConfirm, setShowExpireConfirm] = useState(false)

  // Payout state
  const [payoutOpen, setPayoutOpen]           = useState(false)
  const [payAmount, setPayAmount]             = useState('')
  const [payBankCode, setPayBankCode]         = useState('')
  const [payAccountNumber, setPayAccountNumber] = useState('')
  const [payNarration, setPayNarration]       = useState('')
  const [lookedUpAccount, setLookedUpAccount] = useState<BankAccount | null>(null)
  const [lookupErr, setLookupErr]             = useState('')
  const [settleResult, setSettleResult]       = useState<SettleResult | null>(null)
  const [settleErr, setSettleErr]             = useState('')

  // Data queries
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

  const { data: banksData } = useQuery({
    queryKey: ['settlement-banks'],
    queryFn: () => api.settlement.listBanks(),
    staleTime: 5 * 60 * 1000,
    enabled: account?.Status === 'active',
  })

  // Mutations
  const onSuccess = (updated: Account) => {
    queryClient.setQueryData(['account', accountRef], updated)
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
  }

  const expireMutation = useMutation({ mutationFn: () => api.accounts.expire(accountRef!), onSuccess })

  const renameMutation = useMutation({
    mutationFn: (name: string) => api.accounts.update(accountRef!, { name }),
    onSuccess: (updated) => { onSuccess(updated); setRenaming(false); setNameInput(''); setRenameError('') },
    onError: (err: Error) => setRenameError(err.message),
  })

  const lookupMutation = useMutation({
    mutationFn: ({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) =>
      api.settlement.lookup(accountNumber, bankCode),
    onSuccess: (data) => { setLookedUpAccount(data); setLookupErr('') },
    onError: (err: Error) => { setLookedUpAccount(null); setLookupErr(err.message) },
  })

  const settleMutation = useMutation({
    mutationFn: () => api.settlement.settle(accountRef!, payAmount, payBankCode, payAccountNumber, payNarration || undefined),
    onSuccess: (data) => {
      setSettleResult(data); setSettleErr('')
      setPayAmount(''); setPayBankCode(''); setPayAccountNumber(''); setPayNarration(''); setLookedUpAccount(null)
    },
    onError: (err: Error) => setSettleErr(err.message),
  })

  const handleAccountNumberChange = (val: string) => {
    setPayAccountNumber(val); setLookedUpAccount(null); setLookupErr('')
  }

  const triggerLookup = (accountNumber: string, bankCode: string) => {
    if (accountNumber.length === 10 && bankCode) lookupMutation.mutate({ accountNumber, bankCode })
  }

  // Loading / error states
  if (isLoading) return (
    <div style={{ ...MONO, padding: 40, fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.12em' }}>LOADING...</div>
  )
  if (error) return (
    <div style={{ ...MONO, padding: 40, fontSize: 11, color: 'var(--red)' }}>{(error as Error).message}</div>
  )
  if (!account) return null

  const rows: [string, string | null, boolean?][] = [
    ['NUBAN',           account.BankAccountNumber, true],
    ['BANK',            account.BankName],
    ['ACCOUNT NAME',    account.BankAccountName],
    ['CURRENCY',        account.Currency],
    ['CALLBACK URL',    account.CallbackURL, true],
    ['EXPECTED AMOUNT', account.ExpectedAmount ? `NGN ${account.ExpectedAmount}` : null, true],
    ['ACCOUNT REF',     account.AccountRef, true],
    ['CREATED',         new Date(account.CreatedAt).toLocaleString()],
  ]

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Back */}
      <Link
        to="/accounts"
        style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', textDecoration: 'none', letterSpacing: '0.12em', display: 'inline-block', marginBottom: 24 }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}
      >
        ← ACCOUNTS
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 4 }}>
            {account.Provider.toUpperCase()}
          </div>
          <h1 style={{ ...MONO, fontSize: 18, color: 'var(--text)', letterSpacing: '0.04em', wordBreak: 'break-all' }}>
            {account.BankAccountName ?? account.AccountRef}
          </h1>
        </div>
        <StatusBadge status={account.Status} />
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 40, alignItems: 'start' }}>

        {/* ── Left: info + history ── */}
        <div>
          <div style={{ border: '1px solid var(--border)', marginBottom: 24 }}>
            {rows.map(([label, value, mono], i) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '10px 16px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', width: 130, flexShrink: 0, paddingTop: 1 }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
                  fontSize: 12, color: value ? 'var(--text)' : 'var(--text-faint)',
                  letterSpacing: mono ? '0.06em' : 0, wordBreak: 'break-all',
                }}>
                  {value ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {/* State history */}
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: showHistory ? 16 : 0 }}
          >
            {showHistory ? 'HIDE HISTORY' : 'VIEW HISTORY'}
          </button>

          {showHistory && (
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 18, marginTop: 16 }}>
              <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-faint)', marginBottom: 14 }}>
                ACCOUNT STATE HISTORY
              </div>
              {(historyData?.history ?? []).length === 0 ? (
                <span style={{ ...MONO, fontSize: 11, color: 'var(--text-faint)' }}>No history yet.</span>
              ) : (
                (historyData?.history ?? []).map(entry => (
                  <div key={entry.ID} style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'flex-start' }}>
                    <div style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap', paddingTop: 1 }}>
                      {new Date(entry.CreatedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div>
                      <div style={{ ...MONO, fontSize: 11, color: 'var(--text)', letterSpacing: '0.06em' }}>
                        {entry.FromStatus ? `${entry.FromStatus.toUpperCase()} → ` : ''}{entry.ToStatus.toUpperCase()}
                      </div>
                      {entry.Reason && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.Reason}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Right: balance + actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Balance card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 20px' }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: 6 }}>BALANCE</div>
            {balanceData ? (
              <div style={{ ...MONO, fontSize: 26, color: 'var(--accent)', letterSpacing: '0.02em', lineHeight: 1 }}>
                ₦{Number(balanceData.balance).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            ) : (
              <div style={{ ...MONO, fontSize: 22, color: 'var(--text-faint)' }}>—</div>
            )}
          </div>

          {/* Rename form */}
          {account.Status === 'active' && (
            <div>
              {!renaming ? (
                <button
                  onClick={() => { setRenaming(true); setNameInput(account.BankAccountName ?? '') }}
                  style={{ ...btn('ghost'), width: '100%', textAlign: 'left' }}
                >
                  RENAME ACCOUNT
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="New account name"
                    style={inputStyle}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => renameMutation.mutate(nameInput)}
                      disabled={renameMutation.isPending || !nameInput.trim()}
                      style={{ ...btn('primary'), flex: 1, opacity: renameMutation.isPending ? 0.5 : 1 }}
                    >
                      {renameMutation.isPending ? '...' : 'SAVE'}
                    </button>
                    <button onClick={() => { setRenaming(false); setRenameError('') }} style={{ ...btn('ghost') }}>
                      CANCEL
                    </button>
                  </div>
                  {renameError && <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{renameError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Payout */}
          {account.Status === 'active' && (
            <button
              onClick={() => { setPayoutOpen(true); setSettleResult(null); setSettleErr('') }}
              style={{ ...btn('outline'), width: '100%', textAlign: 'left' }}
            >
              INITIATE PAYOUT →
            </button>
          )}

          {/* Statement */}
          <Link
            to={`/accounts/${accountRef}/statement`}
            style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '8px 16px', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none', display: 'block' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            VIEW STATEMENT →
          </Link>

          {/* Expire */}
          {account.Status === 'active' && (
            <button
              onClick={() => setShowExpireConfirm(true)}
              style={{ ...btn('danger'), width: '100%', textAlign: 'left', marginTop: 8 }}
            >
              EXPIRE ACCOUNT
            </button>
          )}

          {expireMutation.error && (
            <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{expireMutation.error.message}</p>
          )}
        </div>
      </div>

      {/* ── Expire confirmation modal ── */}
      {showExpireConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 32, maxWidth: 440, width: '90%' }}>
            <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: 'var(--red)', marginBottom: 12 }}>
              IRREVERSIBLE ACTION
            </div>
            <h3 style={{ ...MONO, fontSize: 15, color: 'var(--text)', letterSpacing: '0.04em', marginBottom: 12 }}>
              Expire Account?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
              This will permanently expire <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{account.BankAccountNumber}</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              The account will stop accepting payments and cannot be reactivated.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowExpireConfirm(false)}
                style={{ ...btn('ghost'), flex: 1 }}
              >
                CANCEL
              </button>
              <button
                onClick={() => { expireMutation.mutate(); setShowExpireConfirm(false) }}
                disabled={expireMutation.isPending}
                style={{ ...btn('danger'), flex: 1, opacity: expireMutation.isPending ? 0.5 : 1 }}
              >
                {expireMutation.isPending ? 'EXPIRING...' : 'CONFIRM EXPIRE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payout slide-in panel ── */}
      {payoutOpen && (
        <>
          <div
            onClick={() => setPayoutOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, height: '100vh', width: 420,
            background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            zIndex: 50, overflowY: 'auto', padding: '32px 28px',
          }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-faint)', marginBottom: 3 }}>OUTBOUND</div>
                <div style={{ ...MONO, fontSize: 14, color: 'var(--text)', letterSpacing: '0.06em' }}>SETTLEMENT</div>
              </div>
              <button onClick={() => setPayoutOpen(false)} style={{ ...MONO, fontSize: 18, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {settleResult ? (
              /* Success state */
              <div>
                <div style={{ ...MONO, fontSize: 11, color: 'var(--green)', letterSpacing: '0.08em', marginBottom: 20 }}>QUEUED ✓</div>
                <div style={{ border: '1px solid var(--border)', padding: 20, marginBottom: 20 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.12em', marginBottom: 4 }}>MERCHANT REF</div>
                    <div style={{ ...MONO, fontSize: 11, color: 'var(--text)', letterSpacing: '0.06em', wordBreak: 'break-all' }}>{settleResult.merchantTxRef}</div>
                  </div>
                  <div>
                    <div style={{ ...MONO, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.12em', marginBottom: 4 }}>AMOUNT</div>
                    <div style={{ ...MONO, fontSize: 22, color: 'var(--accent)' }}>
                      ₦{Number(settleResult.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                  The transfer has been queued. It will be processed within seconds. Check the statement for confirmation.
                </p>
                <button onClick={() => setSettleResult(null)} style={{ ...btn('ghost'), width: '100%' }}>
                  NEW PAYOUT
                </button>
              </div>
            ) : (
              /* Form */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Bank */}
                <div>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>BANK</div>
                  <select
                    value={payBankCode}
                    onChange={e => {
                      const code = e.target.value
                      setPayBankCode(code)
                      setLookedUpAccount(null)
                      setLookupErr('')
                      triggerLookup(payAccountNumber, code)
                    }}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    <option value="">Select bank...</option>
                    {(banksData?.banks ?? []).map(b => (
                      <option key={b.Code} value={b.Code}>{b.Name}</option>
                    ))}
                  </select>
                </div>

                {/* Account number */}
                <div>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>ACCOUNT NUMBER</div>
                  <input
                    type="text"
                    value={payAccountNumber}
                    maxLength={10}
                    onChange={e => handleAccountNumberChange(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => triggerLookup(payAccountNumber, payBankCode)}
                    placeholder="10 digits"
                    style={inputStyle}
                  />
                  {lookupMutation.isPending && (
                    <div style={{ ...MONO, fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>verifying...</div>
                  )}
                  {lookedUpAccount && (
                    <div style={{ ...MONO, fontSize: 11, color: 'var(--green)', marginTop: 4, letterSpacing: '0.06em' }}>
                      ✓ {lookedUpAccount.AccountName}
                    </div>
                  )}
                  {lookupErr && (
                    <div style={{ ...MONO, fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{lookupErr}</div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>AMOUNT (NGN)</div>
                  <input
                    type="text"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="e.g. 5000.00"
                    style={inputStyle}
                  />
                </div>

                {/* Narration */}
                <div>
                  <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    NARRATION <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
                  </div>
                  <input
                    type="text"
                    value={payNarration}
                    onChange={e => setPayNarration(e.target.value)}
                    placeholder="Transfer description"
                    style={inputStyle}
                  />
                </div>

                {settleErr && (
                  <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{settleErr}</p>
                )}

                <button
                  onClick={() => settleMutation.mutate()}
                  disabled={!lookedUpAccount || !payAmount || !payBankCode || settleMutation.isPending}
                  style={{
                    ...MONO, fontSize: 10, letterSpacing: '0.12em', padding: '11px 20px',
                    background: (lookedUpAccount && payAmount && payBankCode) ? 'var(--accent)' : 'var(--surface-raised)',
                    color: (lookedUpAccount && payAmount && payBankCode) ? 'var(--accent-fg)' : 'var(--text-faint)',
                    border: 'none',
                    cursor: (lookedUpAccount && payAmount && payBankCode && !settleMutation.isPending) ? 'pointer' : 'not-allowed',
                    opacity: settleMutation.isPending ? 0.5 : 1,
                    width: '100%',
                  }}
                >
                  {settleMutation.isPending ? 'QUEUING...' : 'CONFIRM & SETTLE'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
