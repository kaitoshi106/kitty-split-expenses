# Kitty — Split Expenses

Track shared expenses, split them, and see who owes whom. No sign-up: creating
a group gives you an invite code, and anyone with the code can join.

**Live demo: https://kitty-p3sv.onrender.com**

> The demo runs on a free hosting tier, so the server sleeps after 15 minutes of
> inactivity. The first request after that takes about a minute while it wakes up.
> Once installed as a PWA, the UI loads instantly from cache; only data has to wait.

## Features

- Groups with invite codes and anonymous, device-bound sessions
- Expenses with multiple payers and equal / exact / percent / weight splits
- Transfers between members and a minimal "settle up" plan
- Per-member balance breakdown, overview charts and an activity log
- Receipt photos, soft delete with trash and restore
- PDF and Excel export of a group report
- Vietnamese and English UI, light / dark / system themes
- Installable PWA with update prompts

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Angular 20 (standalone, signals, zoneless), Tailwind CSS v4, Angular Service Worker |
| Backend | NestJS 11, TypeORM, PostgreSQL 16, JWT, Swagger |
| Tooling | Nx monorepo, pnpm, Jest, ESLint, Docker |
| Hosting | Render (single Docker image) + Neon Postgres |

```
apps/
  web/            Angular app
  api/            NestJS API
libs/
  shared-money/   All money arithmetic: framework-free TypeScript, integer minor units
  shared-types/   DTOs and interfaces shared by web and api
```

## Design notes

- **Money is an integer in minor units** (`BIGINT` in Postgres, safe integers in
  TypeScript). 100,000 VND is stored as `100000`. Floating point never enters
  the money path.
- **Invariants are tested:** the shares of an expense sum to its amount, the
  payers sum to its amount, and all balances in a group sum to zero.
- **Balances are never stored.** They are always derived from expenses and
  transfers, so there is no cached state that can drift.
- **The app runs without zone.js.** All rendered state lives in signals.

## AI-assisted workflow

I used AI coding agents (Claude Code, Codex) as pair programmers. To keep their
output consistent with the codebase, the repo carries its own agent setup:

| Path | Purpose |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Entry point: commands, structure, the invariants that must never break |
| [`.agents/rules/`](.agents/rules) | Always-on conventions: domain glossary, money, Angular, NestJS, git and testing |
| [`.agents/skills/`](.agents/skills) | Step-by-step playbooks for recurring tasks (new UI component, feature screen, Nest module, migration) plus third-party skills for code review, design and debugging |

Every change still went through review, the money invariant tests and e2e tests.

## Running locally

Requirements: **Node 24** (`nvm use` reads `.nvmrc`), **pnpm 9** (`corepack enable`),
and **Docker** for Postgres.

```bash
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up && pnpm db:migrate     # Postgres in Docker + schema
pnpm dev                          # web on :4200, api on :3000
```

Open http://localhost:4200. The web app proxies `/api/*` to the backend, so
there is no CORS setup. The API takes ~20 seconds longer than the web app to
start; `pnpm dev:wait` blocks until it is ready.

| Command | Purpose |
|---|---|
| `pnpm dev` / `dev:web` / `dev:api` | Run both apps or one of them |
| `pnpm db:up` / `db:down` / `db:reset` | Start, stop or wipe Postgres |
| `pnpm db:migrate` | Run migrations |
| `pnpm test` | Unit tests |
| `pnpm e2e` | End-to-end tests over HTTP against the built API |
| `pnpm lint` | Lint all projects |

### Production build locally

This runs the same Docker image that is deployed:

```bash
cp .env.production.example .env.production   # fill in the two secrets
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Open http://localhost:8080. Generate secrets with `openssl rand -base64 48`.
