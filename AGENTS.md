# Kitty — Guide for AI agents

Group expense splitting with no sign-up. Nx monorepo: Angular 20 + NestJS 11 + PostgreSQL 16.

## Commands

```bash
nvm use            # required in every new shell (Node 24, pinned in .nvmrc)
pnpm db:up         # PostgreSQL in Docker, host port 5434
pnpm db:migrate    # apply TypeORM migrations (needs apps/api/.env)
pnpm dev           # web :4200 + api :3000 in parallel (web proxies /api/*)
pnpm dev:wait      # block until /api/health answers (the API starts ~20 s after the web app)
pnpm test          # unit tests for every project
pnpm lint
pnpm build
pnpm e2e           # builds the API, then runs apps/api/e2e/*.e2e.ts against a kitty_test DB
pnpm graph         # project dependency graph
```

Other scripts: `db:generate`, `db:revert`, `db:seed`, `db:psql`, `db:down`, `db:reset` (**wipes all data**), `dev:web`, `dev:api`.

## Layout

```
apps/web             Angular 20 — standalone, signals, zoneless, Tailwind v4
apps/api             NestJS 11 — TypeORM, PostgreSQL, JWT
libs/shared-types    DTOs and interfaces shared by web and api
libs/shared-money    All money arithmetic — framework-free TypeScript
```

## Five rules that must never break

1. **Money is an integer in minor units** — `number` (safe integers) in TypeScript, `BIGINT` in Postgres via `bigintTransformer`. No floats in the money path.
2. **`SUM(shares) === amount`** and **`SUM(payers) === amount`** — enforced and tested.
3. **`SUM(all balances) === 0`** — any drift is a bug.
4. **Balances are never stored** — always derived from expenses and payments.
5. **`ui/` never imports domain types** (`Expense`, `Member`, …). Primitives only.

## Working agreement

- Propose a short plan before changes that touch several files; keep diffs small and focused.
- Use the domain names in [`.agents/rules/00-project.md`](.agents/rules/00-project.md). Add a new concept there before using it in code.
- Run `pnpm test` and `pnpm lint` (plus `pnpm build` / `pnpm e2e` when relevant) before saying a task is done. Report failures with their output.
- Never upgrade or re-pin dependencies unless asked.
- Commits: one-line message describing what changed. **No** `Co-Authored-By` trailers or any other AI-tool attribution.

## Details

**Read [`.agents/rules/00-project.md`](.agents/rules/00-project.md) first** — domain glossary, module boundaries and data model.

### Rules — always apply (`.agents/rules/`)

| File | Covers |
|---|---|
| `00-project.md` | Product, domain glossary, module boundaries, pinned stack, working agreement |
| `01-money.md` | Money rules, invariants, common mistakes |
| `02-frontend.md` | Angular conventions |
| `03-backend.md` | NestJS and database conventions |
| `04-workflow.md` | Git, versions, testing |

### Skills — load on demand (`.agents/skills/`)

Also exposed to Claude Code through symlinks in `.claude/skills/`.

| Skill | Use when | Source |
|---|---|---|
| `add-ui-component` | Adding a reusable component to `ui/` | project |
| `add-feature-screen` | Adding a domain screen to `features/` | project |
| `add-nest-module` | Adding a backend module | project |
| `add-migration` | Changing the database schema | project |
| `code-review` | Reviewing a diff against standards and spec | `mattpocock/skills` |
| `codebase-design` | Designing a module or deciding where a seam goes | `mattpocock/skills` |
| `diagnosing-bugs` | Hard bugs, unclear failures, performance regressions | `mattpocock/skills` |

Third-party skills are pinned (source + hash) in `skills-lock.json`. The coding standards `code-review` checks against live in **`.agents/rules/`**.
