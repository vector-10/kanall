const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

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

// Auth/me and other map[string]any responses use camelCase keys
export interface Tenant {
  id: string
  name: string
  email: string | null
  status: string
  apiKeySuffix: string | null
  kycStatus: string
  businessType: string | null
  webhookUrl: string | null
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

export interface Customer {
  ID: string
  TenantID: string
  ExternalRef: string
  Name: string
  BVNLast4: string | null
  NINLast4: string | null
  KYCTier: number
  KYCStatus: string
  Status: string
  CreatedAt: string
  UpdatedAt: string
}

export interface LedgerEntry {
  ID: string
  Direction: 'credit' | 'debit'
  Amount: string
  Fee: string
  Currency: string
  Status: 'provisional' | 'confirmed' | 'reversed' | 'needs_review'
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

export interface WebhookEvent {
  ID: string
  NombaTxnRef: string | null
  SignatureValid: boolean
  Status: string
  Category: string | null
  ErrorMessage: string | null
  RetryCount: number
  ReceivedAt: string
  ProcessedAt: string | null
}

export interface AccountStateLog {
  ID: string
  VirtualAccountID: string
  FromStatus: string | null
  ToStatus: string
  Reason: string | null
  CreatedAt: string
}

export interface AccountsResponse {
  accounts: Account[]
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean }
}

export interface CustomersResponse {
  customers: Customer[]
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean }
}

export interface Bank {
  Code: string
  Name: string
}

export interface BankAccount {
  AccountNumber: string
  AccountName: string
}

export interface SettleResult {
  merchantTxRef: string
  status: string
  amount: string
  currency: string
  accountRef: string
}

export const api = {
  health: (): Promise<boolean> =>
    fetch(BASE + '/health', { credentials: 'include' })
      .then(r => r.ok)
      .catch(() => false),

  register: (name: string, email: string, password: string) =>
    request<{ tenantId: string }>('POST', '/register', { name, email, password }),

  verifyEmail: (tenantId: string, otp: string) =>
    request<{ apiKey: string }>('POST', '/auth/verify-email', { tenantId, otp }),

  auth: {
    login: (email: string, password: string) =>
      request<{ status: string }>('POST', '/auth/login', { email, password }),

    logout: () =>
      request<{ status: string }>('POST', '/auth/logout'),

    me: () => request<Tenant>('GET', '/auth/me'),

    rotateKey: () => request<{ apiKey: string }>('POST', '/auth/rotate-key'),

    submitBusinessKYC: (businessType: string, cacNumber?: string) =>
      request<{ kycStatus: string; businessType: string }>('POST', '/auth/business-kyc', { businessType, cacNumber }),

    webhookSecret: () =>
      request<{ webhookSecret: string }>('POST', '/auth/webhook-secret'),

    setWebhookUrl: (url: string) =>
      request<{ webhookUrl: string }>('POST', '/auth/webhook-url', { url }),
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

    update: (ref: string, body: { callbackUrl?: string; expectedAmount?: number; name?: string }) =>
      request<Account>('PATCH', `/v1/accounts/${ref}`, body),

    expire: (ref: string) =>
      request<Account>('POST', `/v1/accounts/${ref}/expire`),

    statement: (ref: string, after?: string) =>
      request<Statement>(
        'GET',
        `/v1/accounts/${ref}/statement${after ? `?after=${after}` : ''}`,
      ),

    balance: (ref: string) =>
      request<{ accountRef: string; balance: string; currency: string }>('GET', `/v1/accounts/${ref}/balance`),

    totalBalance: () =>
      request<{ balance: string; currency: string }>('GET', '/v1/balance'),

    history: (ref: string) =>
      request<{ history: AccountStateLog[] | null }>('GET', `/v1/accounts/${ref}/history`),
  },

  customers: {
    list: (after?: string) =>
      request<CustomersResponse>(
        'GET',
        `/v1/customers${after ? `?after=${after}` : ''}`,
      ),

    get: (id: string) => request<Customer>('GET', `/v1/customers/${id}`),

    patch: (id: string, body: { name: string }) =>
      request<Customer>('PATCH', `/v1/customers/${id}`, body),

    upgradeKYC: (id: string, nin: string, ninDocument: string) =>
      request<Customer>('POST', `/v1/customers/${id}/kyc`, { nin, nin_document: ninDocument }),

    approveKYC: (id: string) =>
      request<Customer>('POST', `/auth/customers/${id}/kyc/approve`),

    rejectKYC: (id: string) =>
      request<Customer>('POST', `/auth/customers/${id}/kyc/reject`),
  },

  webhooks: {
    deadLetters: () =>
      request<{ deadLetters: WebhookDelivery[] }>('GET', '/v1/webhooks/dead-letters'),

    misdirected: () =>
      request<{ events: WebhookEvent[] | null }>('GET', '/auth/misdirected'),

    needsReview: () =>
      request<{ entries: LedgerEntry[] | null }>('GET', '/v1/webhooks/needs-review'),
  },

  settlement: {
    listBanks: () =>
      request<{ banks: Bank[] }>('GET', '/v1/transfers/banks'),

    lookup: (accountNumber: string, bankCode: string) =>
      request<BankAccount>('POST', '/v1/transfers/lookup', { accountNumber, bankCode }),

    settle: (accountRef: string, amount: string, bankCode: string, accountNumber: string, narration?: string) =>
      request<SettleResult>('POST', `/v1/accounts/${accountRef}/settle`, {
        amount,
        bankCode,
        accountNumber,
        ...(narration ? { narration } : {}),
      }),
  },

  // kept for backwards compat with existing call sites
  deadLetters: () =>
    request<{ deadLetters: WebhookDelivery[] }>('GET', '/v1/webhooks/dead-letters'),
}
