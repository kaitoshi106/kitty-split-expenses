# Git, versions, tests

## Commits

```
feat(ui): add ui-amount with sign-based colouring
fix(expenses): distribute the remainder correctly for a single member
refactor: name identifiers in english
chore: pin typeorm to 0.3
```

- Conventional-commit style, **one-line message**, no body.
- Each commit is **one working change**. Don't bundle ten things.
- **No** `Co-Authored-By` trailers or any other AI-tool attribution. The repo owner is the sole author.
- Exclude personal AI-tool config with `.git/info/exclude`, **not** `.gitignore` (`.gitignore` is committed, so listing it there exposes it).

## Versions — don't upgrade

The stack is pinned on purpose. **Don't** run `pnpm update` or change a major version unless asked.

When adding a package:
- Pin the major explicitly; never `@latest` for scaffolding tools.
- `nx` and every `@nx/*` package must be on the **same version**.
- If the installed version differs from what was expected, **say so immediately** — don't quietly adjust docs to match.

## Tests — spend effort where bugs are expensive

| Area | Level |
|---|---|
| `libs/shared-money` | **Thorough.** Unit + property-based (`fast-check`). Mandatory. |
| Backend services and guards | Unit tests with fakes (e.g. `common/guards/guards.spec.ts`) |
| API flows | e2e in `apps/api/e2e/` (`node:test` against the built server, `pnpm e2e`) |
| UI | Unit tests for logic-heavy pieces (inputs, i18n); visual check for layout |

Why: a bug in money splitting is silent and costly; a CSS bug is obvious at a glance.

## Before saying "done"

Run it, don't guess:

```bash
pnpm build     # both apps
pnpm test
pnpm lint
pnpm e2e       # when API behaviour changed (needs Postgres running)
```

Never claim success because the code "looks right". If tests fail, say so and include the output.

## Environment

```bash
nvm use        # REQUIRED in every new shell, or the Node version is wrong
pnpm db:up     # Postgres must be running before pnpm dev / pnpm e2e
```

⚠️ `pnpm db:reset` deletes **all data**.
