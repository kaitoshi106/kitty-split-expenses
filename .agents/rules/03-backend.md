# NestJS + database conventions (`apps/api`)

NestJS 11 · TypeORM 0.3 · PostgreSQL 16

## Module layout

```
modules/expenses/
├── expenses.module.ts
├── expenses.controller.ts    thin — routing only, no logic
├── expenses.service.ts       business logic + data access
└── dto/
    └── expense.dto.ts        request bodies with class-validator decorators
```

Controllers hold **no** logic. Services know **nothing** about HTTP (no `Request`, no `Response`).

## Validate at the edge, not in the service

```ts
// ✅ The DTO does it; the global ValidationPipe (APP_PIPE) runs it
export class CreateExpenseBody {
  @IsString() @Length(1, 120)  title!: string;
  @IsInt() @Min(1)             amountMinor!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PayerBody)
  payers!: PayerBody[];
}

// ❌ don't write if (!dto.title) throw ... in the service
```

Business-rule checks (sums, membership) stay in the service and throw `AppError`.

## Multi-table writes need a transaction

Creating or editing an expense writes three tables (`expenses`, `expense_payers`, `expense_shares`). It must be atomic:

```ts
await this.dataSource.transaction(async (m) => {
  const expense = await m.save(ExpenseEntity, {...});
  await m.save(ExpensePayerEntity, payers);
  await m.save(ExpenseShareEntity, shares);
});
```

Editing an expense = **delete the child rows and re-insert** inside the transaction; don't diff row by row. Child rows are few, so this is simpler and has fewer edge cases.

## Security — layered guards

```
JwtAuthGuard      valid token? is its jti still live in group_sessions?
GroupMemberGuard  does the token belong to the group in the URL (:gid)?   ← missing = IDOR
AdminGuard        is the caller's role 'admin'?
```

`JwtAuthGuard` is global (`APP_GUARD`); public routes opt out with `@Public()`.
Closed by default, opened one route at a time.

| Action | Who |
|---|---|
| Remove a member · change group settings · rotate invite code · delete the group | **Admins only** (`AdminGuard`) |
| Rename a member | An admin, or **the member themself** (checked in the service) |
| Promote / demote admin | An admin; any member if the group has no admin left. The last admin can't be demoted or removed. |
| Add members · manage categories · all expense/payment actions | Any member |

Principle: lock down what is **irreversible and affects others**; leave everyday group work open.

## TypeORM

```ts
// ⚠️ EVERY money column needs the transformer, or BIGINT comes back as a string
@Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
amountMinor!: number;

@DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })   // soft delete
deletedAt!: Date | null;
```

- `synchronize: false` — **always**. It can silently drop columns.
- Every schema change goes through a migration in `apps/api/src/migrations/`, committed to git.
- `onDelete: 'CASCADE'` on relations to `groups` (and from payer/share rows to their expense). **No** cascade on relations to `members` — removing a member must not take history with it.

## Soft delete

`groups`, `members`, `categories`, `expenses` and `payments` have `deleted_at`. Business queries must exclude soft-deleted rows (`find()` does this automatically).
Deleting an expense is contentious inside a group — it must be restorable (the trash screen).

## Error format

Throw `AppError` (`common/app-error.ts`):

```jsonc
{
  "statusCode": 422,
  "error": "SHARES_SUM_MISMATCH",     // machine-readable code — the frontend switches on this
  "message": "Tổng các phần chia (99000) không bằng số tiền (100000)",
  "details": { "expected": 100000, "actual": 99000 }
}
```

Never make the frontend match on `message` — it is localized and a typo fix would break it.

## Business logic stays framework-free

Splitting, balances and settle-up live in `libs/shared-money` — plain TypeScript, no NestJS imports. Services only call it.

That keeps tests fast and lets the frontend reuse exactly the same code.
