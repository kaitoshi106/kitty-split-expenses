---
name: add-migration
description: Workflow for adding a TypeORM migration whenever the database schema changes. Stresses READING the generated SQL before running it, and checking that it reverts.
---

# Workflow: add a migration

`synchronize: false` (in both `app.module.ts` and `data-source.ts`), so **every** schema change goes through a migration.

## Steps

**1 · Change the entity** — `apps/api/src/entities/<name>.entity.ts`

```ts
@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // EVERY money column needs the transformer: pg returns BIGINT as a string
  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
  amountMinor!: number;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
```

Conventions: class `<Name>Entity`, snake_case column names via `name:`, `timestamptz` for timestamps. A **new** entity must be exported from `entities/index.ts` — the CLI data source loads entities from there — and registered with `TypeOrmModule.forFeature([...])` in its module.

**2 · Generate the migration**

The database must be up (`pnpm db:up`) and already migrated, because the generator diffs entities against the live schema.

```bash
pnpm db:generate apps/api/src/migrations/AddThing
# → apps/api/src/migrations/<timestamp>-AddThing.ts
```

**3 · READ the generated SQL** — the most important step

Open the new file in `apps/api/src/migrations/` and check every statement in `up()` and `down()`.

Danger signs:

| You see | It means |
|---|---|
| `DROP CONSTRAINT` on a CHECK (`*_chk`, `*_positive`, `*_not_blank`…) or `DROP INDEX` on a partial `*_uk` index | These are hand-written in `AddConstraints` and invisible to entities, so the generator tries to drop them every time. **Delete those lines** from `up()` and their re-creation from `down()` |
| An unexpected `DROP COLUMN` | Entity and DB have drifted — stop and investigate |
| `ALTER COLUMN ... TYPE` on a money column | Possible data loss |
| `numeric` instead of `bigint` on a money column | The entity is declared wrong |

A migration is code. Edit it by hand, and do so whenever the generator gets it wrong. Constraints TypeORM cannot express (CHECKs, partial unique indexes) are written by hand, as in `1789526324559-AddConstraints.ts`.

**4 · Run it**

```bash
pnpm db:migrate
pnpm db:psql -c '\d payments'     # confirm the real schema
```

**5 · Check it reverts**

```bash
pnpm db:revert
pnpm db:migrate
```

A migration that cannot be reverted is not finished.

**6 · Commit** — the migration goes in the same commit as the entity change. Never split them.

## Never

- Turn on `synchronize: true` "to save time" — it can silently drop columns
- Edit a migration that has **already run anywhere else** (another machine, production) — write a new one
- Change the schema directly with `psql` without capturing it in a migration

## When migrations get tangled in dev

```bash
pnpm db:reset      # DELETES ALL DATA (drops the Docker volume) — local only
pnpm db:migrate    # once Postgres reports healthy
```
