# kanall

kanall is a multi-tenant, domain-blind backend infrastructure primitive for dedicated virtual accounts, built on Nomba's production APIs.

It is a **system of record, not a custodian**. Nomba holds the funds. kanall holds the attribution, the ledger, and the reconciliation. Any business — a logistics company, a savings platform, a freelance marketplace — can use kanall to provision virtual accounts for their users without building payment infrastructure from scratch.

Built for the **Nomba x DevCareer Hackathon 2026, Infrastructure Track** by **Team Prótos**.

---

## What it does

- **Provision real NUBANs** for customers under any tenant via Nomba's virtual accounts API, with full isolation between tenants
- **Record every inbound payment** as a true double-entry ledger event — two rows, same `transaction_group_id`, always sum to zero
- **Idempotency gate** — the `processed_events` INSERT happens in the same DB transaction as the ledger write; a duplicate `requestId` returns 200 and posts nothing
- **Convergence sweep** — a background goroutine re-queries Nomba's Transactions API, promoting provisional entries to confirmed or posting reversal groups when Nomba does not confirm them
- **Outbound delivery** — tenant callback URLs dispatched from a transactional outbox with exponential backoff and dead-letter visibility
- **Dashboard** — a React + Tailwind frontend for account management, statement viewing, and webhook dead-letter monitoring

---

## Architecture

The layering is strict: handlers call services, services call repositories, repositories call the database. Nothing skips a layer.

```
cmd/server/main.go     entrypoint: config → pgxpool → chi router → listen
internal/config/       env loading (godotenv), typed Config struct
internal/model/        plain Go structs mirroring DB tables, no methods
internal/repository/   all SQL — one file per table, receives pgxpool.Pool
internal/service/      business logic — orchestrates repos + provider
internal/handler/      HTTP handlers + route registration (chi)
internal/middleware/   tenant auth (API key), rate limiting, request-id, logging, CORS
internal/provider/     VirtualAccountProvider interface + NombaProvider
```

---

## Key design decisions

**True double-entry ledger** — every inbound payment creates exactly two ledger rows sharing a `transaction_group_id`: a credit to the virtual account and a debit to the tenant settlement account. Entries are append-only; corrections post new reversal groups, never mutate existing rows.

**Idempotency** — the `processed_events` table (keyed on `requestId` from the Nomba webhook payload) is inserted in the same database transaction as the ledger write. Zero rows affected means already processed — return 200 immediately without re-posting entries.

**Truth hierarchy** — webhooks are hints. kanall verifies them, posts provisional entries, and trusts them enough to notify tenants. The convergence sweep re-queries Nomba and is the only process that promotes entries from `provisional` to `confirmed`.

**Webhook verification** — Nomba's signature is not a raw body hash. The signed string is a 9-field colon-separated value: `{event_type}:{requestId}:{merchant.userId}:{merchant.walletId}:{transactionId}:{type}:{time}:{responseCode}:{nomba-timestamp}`. HMAC-SHA256, base64-encoded output. Always returns 200 to Nomba — failures are dead-lettered internally.

**Domain-blind core** — no vertical-specific nouns anywhere in the schema or logic.

---

## Chaos harness output

```
Kanall Chaos Harness
server=http://localhost:8080  workers=10  requests=50

─── 1. Webhook Flood ───
PASS  flood: 50 requests in 0.20s → 249 RPS
PASS  flood: all 50 returned 200 (no panics, no drops)

─── 2. Idempotency Storm ───
PASS  idempotency: 10 concurrent dupes all returned 200 (server always ACKs — never 4xx on dup)
PASS  idempotency: statement has 0 credit line(s) total — verify manually that requestId 604d7cdf appears exactly once

─── 3. Invalid Signature ───
PASS  invalid-sig: server returned 200 (correctly dead-letters, does not reject at HTTP level)

─── 4. Provisioning Race ───
PASS  provision-race: all 10 concurrent requests returned 200/201
PASS  provision-race: all 10 goroutines received identical accountRef fb07b9b4-6520-4133-bf88-9a8db4f28970 (race handled correctly)

════════════════════════════
  7 passed   0 failed
```

---

## Getting started

### Prerequisites

- Go 1.22+
- Docker (for PostgreSQL only)
- [golang-migrate CLI](https://github.com/golang-migrate/migrate)
- [Air](https://github.com/air-verse/air) (optional, for live reload)
- Node 18+ (for the frontend)

### Backend setup

```bash
cd backend

# 1. Start PostgreSQL
docker compose up -d

# 2. Fill environment variables
cp .env.example .env   # then edit .env

# 3. Apply migrations
migrate -path db/migrations -database "$DATABASE_URL" up

# 4. Run the server
air
# or without live reload:
go run ./cmd/server
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

---

## Environment variables

All defined in `backend/.env`. Required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NOMBA_BASE_URL` | `https://api.nomba.com` |
| `NOMBA_ACCOUNT_ID` | Parent account ID |
| `NOMBA_SUB_ACCOUNT_ID` | Sub-account ID |
| `NOMBA_CLIENT_ID` | OAuth client ID |
| `NOMBA_CLIENT_SECRET` | OAuth client secret |
| `NOMBA_WEBHOOK_SIGNING_SECRET` | Secret for verifying inbound webhook signatures |
| `ENCRYPTION_KEY` | 32 bytes as 64 hex chars — `openssl rand -hex 32` |

Optional:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `ENV` | `development` | Environment name |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `CONVERGENCE_SWEEP_INTERVAL_SECONDS` | `60` | How often the sweep runs |

---

## API

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Register a new tenant. Returns `tenantId`. |
| `POST` | `/auth/verify-email` | Submit OTP. Returns `apiKey` (shown once) and sets session cookie. |
| `POST` | `/auth/login` | Email + password login. Sets session cookie. |
| `POST` | `/auth/logout` | Invalidates session cookie. |
| `GET` | `/auth/me` | Returns the authenticated tenant. |
| `POST` | `/auth/rotate-key` | Rotate API key. Returns new key once. |

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhooks/nomba` | Nomba endpoint verification ping. Returns 200. |
| `POST` | `/webhooks/nomba` | Inbound payment webhook. Verified by HMAC-SHA256. Always returns 200. |
| `GET` | `/health` | Health check with database connectivity status. |

### Tenant API (requires `X-API-Key` header)

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/accounts` | Provision a virtual account. Idempotent on `externalRef`. |
| `GET` | `/v1/accounts` | List all virtual accounts. Cursor-paginated. |
| `GET` | `/v1/accounts/:accountRef` | Fetch a virtual account. |
| `PATCH` | `/v1/accounts/:accountRef` | Update `callbackUrl` or `expectedAmount`. |
| `POST` | `/v1/accounts/:accountRef/expire` | Expire a virtual account. Calls Nomba's expire API. |
| `GET` | `/v1/accounts/:accountRef/statement` | Paginated ledger statement with running balances. |
| `GET` | `/v1/customers` | List all customers. |
| `GET` | `/v1/customers/:id` | Fetch a customer. |
| `GET` | `/v1/webhooks/dead-letters` | List failed inbound webhook events. |

Rate limits are per route group: 5/min for registration, 10/min for login, 20/min for account writes, 100/min for reads.

---

## Development

```bash
cd backend

# Live reload
air

# Build
go build -o ./tmp/server ./cmd/server

# Tidy dependencies
go mod tidy

# Apply migrations
migrate -path db/migrations -database "$DATABASE_URL" up

# Roll back last migration
migrate -path db/migrations -database "$DATABASE_URL" down 1

# Run chaos harness
NOMBA_WEBHOOK_SIGNING_SECRET=<secret> \
CHAOS_ACCOUNT_REF=<accountRef> \
API_KEY=<tenantApiKey> \
go run ./cmd/chaos/main.go
```

---

## Project structure

```
backend/
├── cmd/
│   ├── server/        # Entrypoint
│   └── chaos/         # Webhook stress + idempotency harness
├── db/migrations/     # SQL migrations (golang-migrate)
└── internal/
    ├── config/        # Environment loading and startup validation
    ├── crypto/        # AES-GCM encryption, API key hashing, session tokens
    ├── handler/       # chi HTTP handlers and router
    ├── middleware/    # TenantAuth, rate limiting, logging, request ID, CORS
    ├── model/         # Plain Go structs mirroring DB tables
    ├── provider/      # VirtualAccountProvider interface + NombaProvider
    ├── repository/    # All SQL — one file per table
    └── service/       # Business logic — orchestrates repos and provider

frontend/
└── src/
    ├── pages/         # AccountsPage, StatementPage, DeadLettersPage, SettingsPage, …
    ├── components/    # Layout, StatusBadge, AuthShell
    └── api.ts         # Typed API client
```

---

## License

MIT
