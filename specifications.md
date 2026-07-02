# kanall — Technical Specification

---

## 1. Purpose

kanall is a backend infrastructure primitive that gives any software business the ability to provision and manage dedicated virtual accounts for their users, without building payment infrastructure themselves.

The core value proposition is attribution and reconciliation. When a payment arrives on Nomba's rails, kanall knows exactly which customer it belongs to, records it immutably, and makes it queryable. The business (tenant) never has to think about ledger design, idempotency, or webhook reliability. kanall handles all of it.

kanall is domain-blind by design. It has no opinion about what kind of business uses it. A logistics company collecting delivery fees, a savings platform accepting deposits, and a freelance marketplace receiving client payments all look identical to kanall. It is a primitive, not a product.

---

## 2. Architecture overview

<!-- System design diagram goes here -->

### Layer order

| Layer | Package | Responsibility |
|---|---|---|
| Entrypoint | `cmd/server` | Config, DB pool, chi router, graceful shutdown |
| Handler | `internal/handler` | HTTP parsing, response formatting, route registration |
| Middleware | `internal/middleware` | Rate limiting, tenant auth, request ID, logging |
| Service | `internal/service` | Business logic, orchestration |
| Repository | `internal/repository` | All SQL, one file per table |
| Model | `internal/model` | Plain Go structs mirroring DB tables |
| Provider | `internal/provider` | Nomba API abstraction |
| Crypto | `internal/crypto` | AES-GCM encryption, API key hashing |
| Config | `internal/config` | Environment loading and startup validation |

Nothing skips a layer. Handlers do not call repositories. Services do not parse HTTP. This boundary is enforced by convention and package structure.

---

## 3. Provider abstraction

All external payment rail calls go through the `VirtualAccountProvider` interface:

```
Provision(ctx, Customer) → VirtualAccount
Fetch(ctx, accountRef) → VirtualAccount
Update(ctx, accountRef, AccountUpdate) → VirtualAccount
Expire(ctx, accountRef) → error
FetchTransactions(ctx, accountRef) → []Transaction
```

One production implementation exists:

- **NombaProvider** — calls the real Nomba REST API (`https://api.nomba.com`). Manages token lifecycle: acquires a client-credentials token (`grant_type: client_credentials`) on first call, caches it, and refreshes 5 minutes before expiry using `grant_type: refresh_token`.

Services depend on the interface, never on a concrete implementation. Swapping the payment rail requires only a new struct that satisfies the interface.

---

## 4. Data model

<!-- ERD diagram goes here -->

### tenants
The top-level entity. Every provisioned account, customer, and ledger entry belongs to exactly one tenant. Isolation is enforced at the SQL layer — every query filters by `tenant_id`.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Business name |
| email | VARCHAR | Unique, nullable for legacy rows |
| api_key_hash | VARCHAR | SHA-256 hash of the raw API key |
| status | VARCHAR | `active`, `pending_verification`, or `suspended` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

The raw API key is never stored. It is generated on registration (after OTP verification) and shown exactly once. Only the SHA-256 hash lives in the database. Session tokens follow the same pattern: raw token in cookie only, hash stored in DB.

### customers
A customer is an end user of the tenant — the person whose money moves. kanall stores only what is needed for attribution.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tenant_id | UUID | FK → tenants |
| external_ref | VARCHAR | Tenant's own identifier for this customer |
| name | VARCHAR | |
| bvn_last4 | VARCHAR | Last 4 digits of BVN, stored in plain text for display |
| bvn_encrypted | TEXT | Full BVN encrypted with AES-GCM, nullable |
| status | VARCHAR | `active` or `suspended` |

`(tenant_id, external_ref)` is unique — a tenant cannot have two customers with the same external reference.

### virtual_accounts
One virtual account per customer per tenant. Maps Nomba's account reference to kanall's internal identifiers.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tenant_id | UUID | FK → tenants |
| customer_id | UUID | FK → customers |
| account_ref | UUID | kanall-generated reference sent to Nomba on provisioning |
| provider | VARCHAR | `nomba` (extensible) |
| bank_account_number | VARCHAR | NUBAN assigned by Nomba |
| bank_account_name | VARCHAR | |
| bank_name | VARCHAR | |
| currency | VARCHAR | `NGN` |
| status | VARCHAR | `active` or `expired` |
| callback_url | TEXT | Optional per-account webhook URL |

### ledger_entries
The most important table in the system. Append-only. Never updated, never deleted.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tenant_id | UUID | FK → tenants |
| transaction_group_id | UUID | Groups the two rows of a double-entry pair |
| nomba_txn_ref | VARCHAR | Nomba's transaction reference |
| account_type | VARCHAR | `virtual_account` or `tenant_settlement` |
| account_id | UUID | References either a virtual account or a tenant |
| direction | VARCHAR | `credit` or `debit` |
| amount | NUMERIC | Always positive, direction encodes the sign |
| currency | VARCHAR | |
| status | VARCHAR | `provisional`, `confirmed`, or `reversed` |
| reverses_group_id | UUID | Set when this entry group corrects a prior group |
| narration | TEXT | Nullable |
| created_at | TIMESTAMPTZ | |

Every payment posts two rows with the same `transaction_group_id`:
- `credit` → `account_type = virtual_account`, `account_id = virtual_accounts.id`
- `debit` → `account_type = tenant_settlement`, `account_id = tenants.id`

The sum of amounts across any group is always zero.

### processed_events
The idempotency gate. One row per Nomba webhook event.

| Column | Type | Notes |
|---|---|---|
| request_id | VARCHAR | Primary key — `requestId` field from the Nomba webhook payload |
| transaction_group_id | UUID | The ledger group this event produced |
| created_at | TIMESTAMPTZ | |

This INSERT and the two ledger entry INSERTs happen in the same database transaction. If the INSERT hits a conflict (duplicate `requestId`), the ledger write does not happen and the webhook handler returns 200 immediately. `requestId` is preferred over `transactionId` because Nomba can send the same payment event multiple times with different transaction references but the same request ID.

### webhook_events
Audit log of every inbound webhook payload.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| nomba_txn_ref | VARCHAR | Nullable, extracted from payload |
| payload_raw | JSONB | Full raw body |
| signature_valid | BOOLEAN | Result of HMAC verification |
| status | VARCHAR | `pending`, `processed`, `failed`, `dead_letter` |
| error_message | TEXT | Nullable |
| retry_count | INT | |

`dead_letter` means the failure is permanent — retrying will never fix it (e.g. malformed amount, unknown account). `failed` means it is transient and could be retried.

### account_state_log
Append-only audit log of every status change on a virtual account.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| virtual_account_id | UUID | FK → virtual_accounts |
| from_status | VARCHAR | Nullable (null on initial creation) |
| to_status | VARCHAR | |
| reason | TEXT | Nullable |
| created_at | TIMESTAMPTZ | |

---

## 5. Core flows

### Tenant registration
1. `POST /register` with `{ name, email, password }` — creates a `pending_verification` tenant and sends a 6-digit OTP to the email address
2. `POST /auth/verify-email` with `{ tenantId, otp }` — verifies OTP, activates tenant, generates API key and session token
3. Server generates 32 random bytes → hex string (64 chars) as the raw API key; SHA-256 hash stored in `tenants.api_key_hash`
4. Session token: raw token set in `HttpOnly` cookie, SHA-256 hash stored in `sessions` table
5. Raw API key is returned in the response exactly once
6. All subsequent API requests authenticate by sending the raw key in `X-API-Key`; the middleware hashes it and looks up the tenant
7. Dashboard requests authenticate via the session cookie

### Virtual account provisioning
1. Tenant sends `POST /v1/accounts` with `{ externalRef, name, bvn?, callbackUrl? }`
2. Service calls `GetByExternalRef` — if customer exists, skip creation
3. If BVN is provided and `ENCRYPTION_KEY` is set, BVN is encrypted with AES-GCM before storage
4. Service generates a UUID as `accountRef` and calls `provider.Provision`
5. Virtual account row is created; state transition logged
6. If a concurrent request created the same customer (unique constraint on `externalRef`), the race is caught by detecting `pgconn error 23505` and re-fetching

### Inbound payment (webhook path)
1. Nomba sends `POST /webhooks/nomba` with headers `nomba-signature` and `nomba-timestamp`
2. Signature is verified by building the 9-field colon-separated signed string: `{event_type}:{requestId}:{merchant.userId}:{merchant.walletId}:{transactionId}:{type}:{time}:{responseCode}:{nomba-timestamp}`, then computing HMAC-SHA256 and base64-encoding the result. Comparison uses `hmac.Equal` (constant-time). Invalid signature → `dead_letter`. **Kanall always returns 200** regardless of outcome — a non-200 would cause Nomba to retry indefinitely.
3. Webhook event is persisted to `webhook_events` regardless of signature validity
4. If event type is not `vact_transfer`, the event is marked `processed` and discarded
5. `processed_events` INSERT (keyed on `requestId`) is attempted in the same DB transaction as the two `ledger_entries` INSERTs
6. If the INSERT hits a conflict → already processed → return 200 without re-posting
7. Permanent failures (unknown account ref, missing requestId) → `dead_letter`; transient failures → `failed`
8. If the virtual account has a `callbackUrl`, a `tenant_webhook_deliveries` row is enqueued for outbound delivery

### Convergence sweep
Runs on a background goroutine every `CONVERGENCE_SWEEP_INTERVAL_SECONDS` seconds.

1. Query all `ledger_entries` where `status = provisional` and `account_type = virtual_account`
2. For each unique `nomba_txn_ref`, call `provider.FetchTransactions` on the associated account
3. If Nomba returns a matching transaction → `UPDATE ledger_entries SET status = confirmed`
4. If Nomba does not return a matching transaction → post a reversal group: two new ledger entries with `reverses_group_id` pointing at the original group, then mark the original entries `reversed`

Webhooks are hints. The sweep is the source of truth.

---

## 6. Key invariants

These must never be broken:

1. **Ledger entries are append-only.** Never `UPDATE` or `DELETE` a ledger row. Corrections post a new reversal group.
2. **The `processed_events` INSERT must be in the same DB transaction as the ledger write.** Not before, not after.
3. **Amount is always `decimal.Decimal`.** Never `float64` for money.
4. **All repository functions accept `context.Context` as their first argument** and respect caller-set deadlines.
5. **Domain-blind core.** No vertical-specific nouns in any schema, model, or service.
6. **Tenant isolation.** Every query that touches tenant-owned data filters by `tenant_id`. No cross-tenant data leakage is possible at the SQL layer.

---

## 7. Security

| Concern | Mechanism |
|---|---|
| Tenant authentication | SHA-256 hash of raw API key, constant-time comparison via `hmac.Equal` |
| Session authentication | Raw token in `HttpOnly` cookie only; SHA-256 hash stored in DB |
| Webhook authenticity | HMAC-SHA256 of 9-field colon-separated string, `nomba-signature` + `nomba-timestamp` headers, base64 output |
| BVN storage | AES-256-GCM encryption, random nonce per ciphertext, key from `ENCRYPTION_KEY` env only |
| Password storage | bcrypt |
| Rate limiting | Per-route: 5/min registration, 10/min login, 20/min account writes, 100/min reads |
| SQL injection | Parameterised queries throughout via `pgx` |

---

## 8. API reference

### POST /register
Register a new tenant.

**Request**
```json
{ "name": "Acme Corp", "email": "dev@acme.com" }
```

**Response 201**
```json
{
  "tenantId": "uuid",
  "apiKey": "64-char-hex-string",
  "warning": "Store this API key securely — it will not be shown again"
}
```

---

### POST /v1/accounts
Provision a virtual account. Idempotent on `externalRef`.

**Request**
```json
{
  "externalRef": "user-123",
  "name": "Jane Doe",
  "bvn": "12345678901",
  "callbackUrl": "https://acme.com/hooks"
}
```

**Response 201** — the created virtual account object.

---

### GET /v1/accounts/:accountRef
Fetch a virtual account by its reference.

**Response 200** — the virtual account object.

---

### GET /v1/accounts/:accountRef/statement
Paginated ledger statement for a virtual account.

**Query params**
- `limit` — entries per page, 1–200, default 50
- `after` — cursor (entry ID of the last entry on the previous page)

**Response 200**
```json
{
  "virtualAccount": { ... },
  "openingBalance": "0.00",
  "totalCredits": "15000.00",
  "totalDebits": "0.00",
  "closingBalance": "15000.00",
  "lines": [
    {
      "entry": { ... },
      "runningBalance": "5000.00"
    }
  ],
  "pagination": {
    "limit": 50,
    "nextCursor": "uuid-or-null",
    "hasMore": false
  }
}
```

`openingBalance` is the net balance at the start of the current page. `runningBalance` per line is accurate across all pages, not just the first.

---

### GET /v1/customers/:id
Fetch a customer by ID.

---

### POST /webhooks/nomba
Receives inbound payment notifications from Nomba. Verifies the HMAC-SHA256 signature on the raw body before processing. Always returns 200 — errors are recorded internally and do not ask Nomba to retry.

---

### GET /health
Returns database connectivity status.

```json
{ "status": "ok" }
```

---

## 9. Configuration

All configuration is loaded once at startup from environment variables. The server will not start if `DATABASE_URL` is missing or if `ENCRYPTION_KEY` is set but is not a valid 32-byte hex string.

See `.env.example` for the full list.

---

## 10. Development tooling

| Tool | Purpose |
|---|---|
| `air` | Live reload during development |
| `golang-migrate` | Database migrations |
| `go test ./...` | Unit test suite |
| `cmd/chaos` | Webhook stress harness — 4 scenarios: flood (249 RPS), idempotency storm (10 concurrent dupes), invalid signature handling, provisioning race (10 concurrent same externalRef) |

---

