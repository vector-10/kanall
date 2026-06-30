const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: HeadersInit = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? 'request failed')
  }

  return res.json() as T
}

// Auth/me returns explicit camelCase keys (Go map[string]any, not a struct)
export interface Tenant {
  id: string
  name: string
  email: string | null
  status: string
  createdAt: string
}

// Go structs without json tags serialize with PascalCase keys
export interface Account {
  ID: string
  TenantID: string
  CustomerID: string
  AccountRef: string
  Provider: string
  BankAccountNumber: string | null
  BankAccountName: string | null
  BankName: string | null
  Currency: string
  Status: string
  CallbackURL: string | null
  ExpectedAmount: string | null
  CreatedAt: string
  UpdatedAt: string
}

export interface LedgerEntry {
  ID: string
  Direction: 'credit' | 'debit'
  Amount: string
  Fee: string
  Currency: string
  Status: 'provisional' | 'confirmed' | 'reversed'
  Narration: string | null
  NombaTxnRef: string
  CreatedAt: string
}

export interface StatementLine {
  entry: LedgerEntry
  runningBalance: string
}

export interface Statement {
  virtualAccount: Account
  lines: StatementLine[]
  openingBalance: string
  totalCredits: string
  totalDebits: string
  closingBalance: string
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean }
}

export interface WebhookDelivery {
  ID: string
  CallbackURL: string
  Status: string
  AttemptCount: number
  LastError: string | null
  NextRetryAt: string | null
  CreatedAt: string
}

export interface AccountsResponse {
  accounts: Account[]
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean }
}

export const api = {
  health: (): Promise<boolean> =>
    fetch(BASE + '/health', { credentials: 'include' })
      .then(r => r.ok)
      .catch(() => false),

  register: (name: string, email: string, password: string) =>
    request<{ tenantId: string; apiKey: string; warning: string }>(
      'POST',
      '/register',
      { name, email, password },
    ),

  auth: {
    login: (email: string, password: string) =>
      request<{ status: string }>('POST', '/auth/login', { email, password }),

    logout: () =>
      request<{ status: string }>('POST', '/auth/logout'),

    me: () => request<Tenant>('GET', '/auth/me'),
  },

  accounts: {
    list: (after?: string) =>
      request<AccountsResponse>(
        'GET',
        `/v1/accounts${after ? `?after=${after}` : ''}`,
      ),

    get: (ref: string) => request<Account>('GET', `/v1/accounts/${ref}`),

    create: (body: {
      externalRef: string
      name: string
      bvn?: string
      callbackUrl?: string
      expectedAmount?: number
    }) => request<Account>('POST', '/v1/accounts', body),

    update: (ref: string, body: { callbackUrl?: string; expectedAmount?: number }) =>
      request<Account>('PATCH', `/v1/accounts/${ref}`, body),

    suspend: (ref: string) =>
      request<Account>('POST', `/v1/accounts/${ref}/suspend`),

    expire: (ref: string) =>
      request<Account>('POST', `/v1/accounts/${ref}/expire`),

    reactivate: (ref: string) =>
      request<Account>('POST', `/v1/accounts/${ref}/reactivate`),

    statement: (ref: string, after?: string) =>
      request<Statement>(
        'GET',
        `/v1/accounts/${ref}/statement${after ? `?after=${after}` : ''}`,
      ),
  },

  deadLetters: () =>
    request<{ deadLetters: WebhookDelivery[] }>('GET', '/v1/webhooks/dead-letters'),
}
