# Kanall Dashboard

React + TypeScript + Vite frontend for the [Kanall](../README.md) virtual account infrastructure platform.

## Pages

| Page | Route | Description |
|---|---|---|
| Accounts | `/accounts` | List and provision virtual accounts |
| Account Detail | `/accounts/:ref` | NUBAN, balance, statement, settle, expire |
| Customers | `/customers` | List and create customer records |
| Customer Detail | `/customers/:id` | KYC status, NIN upgrade, linked account and statement access |
| Settings | `/settings` | API key rotation, webhook URL, business KYC |
| Webhooks | `/webhooks` | Dead letters, misdirected payments, needs-review entries |

## Running locally

```bash
npm install
npm run dev
```

Set `VITE_API_URL` in a `.env.local` file to point at your backend:

```
VITE_API_URL=http://localhost:8080
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Backend base URL |

## Stack

React 18 · TypeScript · Vite · TanStack Query · React Router v6
