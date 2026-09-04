# Project context

## What Kitty is

Group expense splitting. No sign-up, no login. It answers two questions:

1. Who owes whom, and how much?
2. What is the smallest set of transfers that clears every debt?

## Terminology

The single source for naming. A name that differs from this table is wrong; add a new concept here before using it in code.

| Term | Meaning | Do NOT call it |
|---|---|---|
| **Group** | A set of people sharing costs | team, room |
| **Member** | A person in a group. Not an account. Role is `admin` or `member`. | user, person |
| **Expense** | A real spend (groceries, hotel) | transaction, bill |
| **Payment** | Money recorded as moving from one member to another to repay debt | settlement |
| **Payer** | A member who paid (part of) an expense | — |
| **Share** | The part of an expense a member is responsible for | split, portion |
| **Split type** | How shares are computed: `equal`, `exact`, `percent`, `weight` | — |
| **Balance** | A member's net position. `> 0` = the group owes them | debt |
| **Settle-up** | The minimal list of transfers that brings every balance to 0 | — |
| **Transfer** | One suggested move in a settle-up plan (computed, never stored). Recording it creates a Payment. | — |
| **Invite code** | 8-character Crockford Base32 code used to join a group | join code, room code |
| **Minor unit** | Smallest unit of a currency. `100000` = 100,000 ₫; `1050` = $10.50 | cents (wrong for VND) |
| **Base currency** | The group's currency; foreign amounts carry `fxRate` and `amountBaseMinor` | — |

### Reading a balance

```
balance > 0  →  the group owes this member (paid more than their shares)
balance < 0  →  this member owes the group
```

## Module boundaries

```
libs/shared-money     Money algorithms. Plain TypeScript, NO framework imports.
                      split · balance (+ settle-up) · format-money · currency · report
                      → Used by both web and api, so the two can never disagree.

libs/shared-types     DTOs and interfaces shared by web and api. No logic.

apps/web/src/app/
  ui/                 Presentation only. NO domain types. Primitives in.
  features/           Domain screens. One folder per route.
  core/               Singletons: ApiService (abstract) · GroupStore · SessionStore (signals)
                      · guards · interceptors · i18n

apps/api/src/
  modules/<name>/     controller (thin) · service (business logic) · dto (validation)
  entities/           TypeORM entities
  migrations/         Every schema change
  common/             guards · filters · decorators · transformers · AppError
```

### The two key seams

**`ApiService` (abstract class)** — implemented by `HttpApiService` (the default) and `MockApiService` (in-memory, for running without the API). Components depend only on the abstraction; switching is one provider line in `app.config.ts`.

**`libs/shared-money`** — business logic fully separated from Angular and NestJS. Its tests run in milliseconds with nothing to boot.

## Data model

```
Group ─┬─ Member ─── GroupSession        (anonymous identity: JWT + jti)
       ├─ Category
       ├─ Expense ─┬─ ExpensePayer       ★ WHO PAID
       │           └─ ExpenseShare       ★ WHO BENEFITS
       ├─ Receipt                        (image attached to an expense)
       ├─ Payment
       └─ ActivityLog
```

`Expense` holds only the **total**. The two sides of the money flow live in two child tables, which is what makes multiple payers and uneven splits possible.

## Stack (pinned — do not upgrade)

```
Node 24  ·  Nx 21.6  ·  Angular 20.3  ·  NestJS 11.2
TypeScript 5.9  ·  TypeORM 0.3  ·  PostgreSQL 16  ·  Tailwind v4
```

Versions were chosen deliberately, favouring mature, well-documented releases over the newest.
**Don't run `pnpm update` or change a major version** unless asked.

## Working agreement

- Propose a short plan before multi-file changes; wait for agreement on anything structural.
- Keep diffs small and scoped to the task. No drive-by refactors.
- Identifiers in English. Web UI text goes through `core/i18n` (Vietnamese and English), never hardcoded in templates.
- Verify before claiming done: run the relevant tests and lint, and report real output.
- No AI attribution in commits (see `04-workflow.md`).
