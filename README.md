# kanall

kanall is a multi-tenant, domain-blind backend infrastructure primitive for dedicated virtual accounts, built on Nomba's APIs.

It is a **system of record, not a custodian**. Nomba holds the funds. kanall holds the attribution, the ledger, and the reconciliation. Any business — a logistics company, a savings platform, a freelance marketplace — can use kanall to provision virtual accounts for their users without building payment infrastructure from scratch.

Built for the **Nomba x DevCareer Hackathon 2026, Infrastructure Track**.

---

## What it does

- **Provision virtual accounts** for customers under any tenant, with full isolation between tenants
- **Record every inbound payment** as a double-entry ledger event — no float, no approximation
- **Reconcile automatically** by treating webhooks as hints and Nomba's Transactions API as canonical truth
- **Expose financial statements** per virtual account with accurate running balances and cursor-based pagination
- **Handle duplicate events** through an idempotency gate that is atomic with the ledger write

---

## Architecture

<!-- System design diagram goes here -->

The layering is strict: handlers call services, services call repositories, repositories call the database. Nothing skips a layer.

**Convergence sweep** — a background goroutine that polls Nomba's Transactions API on a configurable interval. It promotes provisional ledger entries to confirmed, or posts reversals when Nomba does not confirm them. Webhooks trigger the first write; the sweep ensures correctness regardless of webhook reliability.

**Provider abstraction** — all provider calls go through the `VirtualAccountProvider` interface. `NombaProvider` talks to the real Nomba API. `MockProvider` is an in-memory fake used when Nomba credentials are absent, making the system fully runnable without external dependencies.

---

## Database Schema

<!-- ERD diagram goes here -->

---

## Key design decisions

**True double-entry ledger** — every inbound payment creates exactly two ledger rows sharing a `transaction_group_id`: a credit to the virtual account and a debit to the tenant settlement account. The sum of any group is always zero. Entries are append-only; corrections post new reversal groups, never mutate existing rows.

**Idempotency** — the `processed_events` table (keyed on `nomba_txn_ref`) is inserted in the same database transaction as the ledger write. Zero rows affected means already processed — return 200 immediately without re-posting entries.

**Truth hierarchy** — webhooks may duplicate, arrive late, or arrive out of order. kanall does not trust them as final. The convergence sweep re-queries Nomba and is the only process that promotes entries from `provisional` to `confirmed`.

**Domain-blind core** — no vertical-specific nouns anywhere in the schema or logic. kanall is a primitive that tenants configure for their own use case.

---

## Getting started

### Prerequisites

- Go 1.22+
- Docker (for PostgreSQL only)
- [golang-migrate CLI](https://github.com/golang-migrate/migrate)
- [Air](https://github.com/air-verse/air) (optional, for live reload)

### Setup

```bash
# 1. Start PostgreSQL
cd backend
docker compose up -d

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Apply migrations
migrate -path db/migrations -database "$DATABASE_URL" up

# 4. Run the server
air
# or without live reload:
go run ./cmd/server
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: `8080`) |
| `ENV` | No | Environment name (default: `development`) |
| `ENCRYPTION_KEY` | No | 32-byte hex key for BVN encryption at rest |
| `NOMBA_BASE_URL` | No | Nomba API base URL |
| `NOMBA_ACCOUNT_ID` | No | Nomba account ID |
| `NOMBA_CLIENT_ID` | No | Nomba client ID |
| `NOMBA_CLIENT_SECRET` | No | Nomba client secret |
| `NOMBA_WEBHOOKS_SIGNING_SECRET` | No | Secret for verifying webhook signatures |
| `CONVERGENCE_SWEEP_INTERVAL_SECONDS` | No | How often the sweep runs (default: `60`) |

When Nomba credentials are absent the server starts with `MockProvider`, an in-memory fake that supports all operations without external calls.

---

## API

### Public

| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Register a new tenant. Returns an API key shown once. |
| `POST` | `/webhooks/nomba` | Inbound webhook receiver. Verified by HMAC-SHA256 signature. |
| `GET` | `/health` | Health check with database connectivity status. |

### Tenant API (requires `X-API-Key` header)

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/accounts` | Provision a virtual account for a customer. |
| `GET` | `/v1/accounts/:accountRef` | Fetch a virtual account. |
| `GET` | `/v1/accounts/:accountRef/statement` | Paginated ledger statement. Supports `?limit=50&after=<entryId>`. |
| `GET` | `/v1/customers/:id` | Fetch a customer. |

Rate limit: 100 requests per minute per API key.

---

## Development

```bash
# Run all tests
go test ./...

# Build
go build -o ./tmp/server ./cmd/server

# Tidy dependencies
go mod tidy

# Roll back last migration
migrate -path db/migrations -database "$DATABASE_URL" down 1

# Run chaos harness (stress test webhooks + idempotency)
CHAOS_ACCOUNT_REF=<accountRef> go run ./cmd/chaos
```

---

## Project structure

```
backend/
├── cmd/
│   ├── server/        # Entrypoint
│   └── chaos/         # Webhook stress harness
├── db/migrations/     # SQL migrations
└── internal/
    ├── config/        # Environment loading and validation
    ├── crypto/        # AES-GCM encryption, API key hashing
    ├── handler/       # Fiber HTTP handlers and router
    ├── middleware/     # TenantAuth, rate limiting, logging, request ID
    ├── model/         # Plain Go structs mirroring DB tables
    ├── provider/      # VirtualAccountProvider interface, NombaProvider, MockProvider
    ├── repository/    # All SQL — one file per table
    └── service/       # Business logic — orchestrates repos and provider
```

---

## License

MIT
