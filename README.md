# Kanall

Virtual account infrastructure for multi-tenant platforms. Give every entity in your system — a driver, a distributor, a merchant — a dedicated Nigerian bank account (NUBAN), and let Kanall handle the attribution, reconciliation, and ledger.

**[Dashboard](https://kanall.vercel.app) · [API](https://kanall.onrender.com/health) · [Docs](https://kanall-docs.vercel.app)**

---

## What it does

- **Dedicated NUBANs per entity** — provision real Nigerian bank accounts via Nomba's production APIs, fully isolated per tenant
- **True double-entry ledger** — every payment posts two rows (credit + debit) sharing a `transaction_group_id`; entries are append-only and always sum to zero
- **Idempotent ingestion** — the `processed_events` gate and the ledger write happen in one database transaction; duplicate webhooks are silently ignored
- **Confirmation pipeline** — fast-path single-transaction query (seconds) + background bulk sweep (minutes) + aged auditor (24h); no payment goes unresolved
- **Outbound delivery** — payment events dispatched to your configured webhook URL with exponential backoff, dead-letter visibility, and HMAC-SHA256 signing
- **Settlement** — initiate outbound bank transfers from virtual account balances, with idempotent retry and automatic reversal on failure
- **Customer KYC pipeline** — three-tier CBN KYC per customer record; Tier 1 auto-collected at provisioning (BVN), Tier 2 via NIN verified through Mono Identity, Tier 3 escalates to manual review; Kanall reports tier, tenants enforce product limits, Nomba enforces banking limits
- **Customer-linked accounts** — each customer has one dedicated virtual account; the customer detail endpoint exposes NUBAN, account name, and statement access in one call
- **Dashboard** — React frontend for account management, statement viewing, per-customer linked account and KYC, settlement, and webhook monitoring

---

## Get started

Sign up at **[kanall.vercel.app](https://kanall.vercel.app)**, verify your email, and copy your API key. Then:

```bash
# Set your webhook URL once — all accounts deliver here
curl -X POST https://kanall.onrender.com/auth/webhook-url \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-backend.com/webhooks/kanall"}'

# Provision a virtual account
curl -X POST https://kanall.onrender.com/v1/accounts \
  -H "X-API-Key: ten_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"externalRef": "user-001", "name": "Emeka Okafor"}'

# Check the ledger
curl https://kanall.onrender.com/v1/accounts/user-001/statement \
  -H "X-API-Key: ten_sk_..."
```

Full integration guide: [kanall-docs.vercel.app](https://kanall-docs.vercel.app)

---

## Running locally

### Prerequisites

- Go 1.22+
- Docker (PostgreSQL only — the Go server runs natively)
- [golang-migrate CLI](https://github.com/golang-migrate/migrate)
- [Air](https://github.com/air-verse/air) for live reload
- Node 18+ (frontend)

### Backend

```bash
cd backend

# Start PostgreSQL
docker compose up -d

# Copy and fill environment variables
cp .env.example .env

# Apply migrations
migrate -path db/migrations -database "$DATABASE_URL" up

# Start with live reload
air

# Or without
go run ./cmd/server
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment variables

All defined in `backend/.env`.

**Required:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NOMBA_BASE_URL` | `https://api.nomba.com` |
| `NOMBA_ACCOUNT_ID` | Nomba parent account ID |
| `NOMBA_SUB_ACCOUNT_ID` | Nomba sub-account ID |
| `NOMBA_CLIENT_ID` | OAuth client ID |
| `NOMBA_CLIENT_SECRET` | OAuth client secret |
| `NOMBA_WEBHOOKS_SIGNING_SECRET` | HMAC secret for verifying inbound Nomba webhooks |
| `ENCRYPTION_KEY` | 32 bytes as 64 hex chars — `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend API key for transactional email (OTP delivery) |

**Optional:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `ENV` | `development` | Set to `production` for production cookie behaviour |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `CONVERGENCE_SWEEP_INTERVAL_SECONDS` | `60` | How often the background confirmation sweep runs |
| `OUTBOX_HTTP_TIMEOUT_SECONDS` | `10` | Timeout for outbound webhook delivery attempts |
| `EMAIL_FROM` | `noreply@kanall.app` | Sender address for OTP emails |
| `MONO_SECRET_KEY` | — | Mono Identity API key for automated Tier 2 NIN verification; without it, submissions go to `pending_review` for admin approval |

---

## API

Full reference: [kanall-docs.vercel.app](https://kanall-docs.vercel.app)

### Public

| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Register a new tenant |
| `POST` | `/auth/verify-email` | Submit OTP — returns API key (shown once) |
| `POST` | `/auth/login` | Email + password login (dashboard session) |
| `POST` | `/auth/logout` | Invalidate session |
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/nomba` | Inbound Nomba webhook — HMAC verified, always returns 200 |

### Tenant API (`X-API-Key` header)

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/balance` | Aggregate balance across all accounts |
| `POST` | `/v1/accounts` | Provision a virtual account |
| `GET` | `/v1/accounts` | List accounts (cursor-paginated) |
| `GET` | `/v1/accounts/:ref` | Get a single account |
| `PATCH` | `/v1/accounts/:ref` | Update name, callbackUrl, or expectedAmount |
| `POST` | `/v1/accounts/:ref/expire` | Permanently close an account |
| `GET` | `/v1/accounts/:ref/balance` | Account ledger balance |
| `GET` | `/v1/accounts/:ref/statement` | Paginated ledger statement with running balances |
| `GET` | `/v1/accounts/:ref/history` | Account status transition log |
| `POST` | `/v1/accounts/:ref/settle` | Initiate an outbound bank transfer |
| `GET` | `/v1/customers` | List customers |
| `GET` | `/v1/customers/:id` | Get a customer |
| `GET` | `/v1/customers/:id/account` | Get the virtual account linked to a customer |
| `PATCH` | `/v1/customers/:id` | Update customer details |
| `POST` | `/v1/customers/:id/kyc` | Submit NIN for Tier 2 upgrade (auto-verified via Mono, falls back to pending_review) |
| `GET` | `/v1/transfers/banks` | List supported Nigerian banks |
| `POST` | `/v1/transfers/lookup` | Resolve a bank account number to a name |
| `GET` | `/v1/transfers/:merchantTxRef` | Get transfer status |
| `GET` | `/v1/fees/calculate` | Calculate the gross amount needed to receive a net amount |
| `GET` | `/v1/webhooks/dead-letters` | Outbound deliveries that exhausted all retries |
| `GET` | `/v1/webhooks/needs-review` | Ledger entries flagged for manual review |

---

## Stack

**Backend:** Go 1.22 · chi · pgx v5 · shopspring/decimal · golang-migrate · Air

**Frontend:** React 18 · TypeScript · Vite · TanStack Query

**Infrastructure:** PostgreSQL · Render (API) · Vercel (frontend + docs) · Resend (email)

**Docs:** Docusaurus v3

---

## Project structure

```
backend/
├── cmd/server/        # Entrypoint
├── db/migrations/     # SQL migrations (golang-migrate)
└── internal/
    ├── config/        # Environment loading
    ├── crypto/        # AES-GCM encryption, key hashing, session tokens
    ├── handler/       # HTTP handlers and chi router
    ├── middleware/     # TenantAuth, rate limiting, logging, CORS
    ├── model/         # Go structs mirroring DB tables
    ├── provider/      # VirtualAccountProvider interface + NombaProvider
    ├── repository/    # All SQL — one file per table
    └── service/       # Business logic, convergence sweep, outbox worker

frontend/
└── src/
    ├── pages/         # AccountsPage, StatementPage, SettingsPage, …
    ├── components/    # Layout, AuthShell, StatusBadge
    └── api.ts         # Typed API client
```

---

Built for the **Nomba × DevCareer Hackathon 2026 — Infrastructure Track** by **Team Prótos**.

MIT License
