# `.agents/`

Rules and skills for AI agents (and for anyone new to the project).

```
rules/    Constraints — ALWAYS read. Short: what is allowed and what is not.
skills/   Procedures — loaded ON DEMAND. Read only the skill that matches the task.
```

`rules/` stays short because it is always in context. `skills/` can be longer because only one is loaded at a time — the frontmatter `description` decides when. Claude Code sees the same skills through symlinks in `.claude/skills/`.

## `rules/` — always apply

| File | Covers |
|---|---|
| `00-project.md` | Product, domain glossary, module boundaries, pinned stack, working agreement |
| `01-money.md` | R1–R5, invariants, common mistakes. A bug here is a wrong balance. |
| `02-frontend.md` | Angular: OnPush/signals/computed, zoneless, the `ui/` ↔ `features/` boundary |
| `03-backend.md` | NestJS: thin controllers, transactions, guards, TypeORM |
| `04-workflow.md` | Git, pinned versions, where testing effort goes |

## `skills/` — load on demand

**Project-specific:**

| Skill | Use when |
|---|---|
| `add-ui-component` | Adding a reusable component to `ui/` |
| `add-feature-screen` | Adding a domain screen to `features/` |
| `add-nest-module` | Adding a backend module |
| `add-migration` | Changing the database schema |

**Third-party** (source: `mattpocock/skills`, pinned in `skills-lock.json`):

| Skill | Use when |
|---|---|
| `code-review` | Reviewing a diff on two axes: coding standards and spec |
| `codebase-design` | Designing a module, deciding where a seam goes |
| `diagnosing-bugs` | Hard bugs, unclear failures, performance regressions |

## Writing files here

| | |
|---|---|
| **Keep `rules/` short** | Always loaded. Long = wasted context = missed rules. |
| **Imperative** | "Use `OnPush` on every component", not "consider using". |
| **✅/❌ examples** | Concrete code beats abstract description. |
| **Point to code, don't copy it** | Name the file that implements a rule instead of restating it. |
| **Skills need frontmatter** | `name` + `description`. The description decides when the skill loads — say when to use it. |

## Reading order

1. [`AGENTS.md`](../AGENTS.md) — overview and commands
2. `rules/00-project.md` — **glossary, module boundaries and data model, the single naming source**
3. `rules/01-money.md` — the most important rule file
4. The rule for the area you're working in (frontend / backend)
5. `skills/<name>/SKILL.md` when the task matches an existing procedure

## Adding a third-party skill

Record it in `skills-lock.json` (source + hash) and add a symlink in `.claude/skills/`. Before committing, check:

- [ ] Does it invoke other skills that aren't installed? (`grep -n "Skill tool with" <file>`)
- [ ] Does it write files to the repo root? If so, constrain the path.
- [ ] Does it assume files that don't exist here (e.g. `docs/adr/`, an issue-tracker config)?
