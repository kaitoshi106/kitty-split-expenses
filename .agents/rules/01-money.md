# Money rules — the most important file

> A mistake here computes someone's money wrong, silently.
> Every change that touches money needs a test.

## R1 · Money is an integer in minor units

```ts
// ✅ RIGHT — number holding a safe integer; BIGINT in Postgres
amountMinor: number   // 100000 = 100,000 ₫ · 1050 = $10.50

// ❌ WRONG — never floats for money
amount: 100.50
total = price * 0.1
```

Why: `0.1 + 0.2 === 0.30000000000000004`.

Floats may appear in **only** two places: exchange rates (`fx_rate`, a `NUMERIC` column) and user-entered percentages/weights — and they must be converted to integers immediately (`computeShares` scales them to integer weights).

## R2 + R3 · Both sums must always match

```
SUM(expense_payers.amount_minor) === expenses.amount_minor   // who paid
SUM(expense_shares.amount_minor) === expenses.amount_minor   // who benefits
```

Never persist an expense that breaks either rule. Validate on **both** sides: the frontend disables Save, the backend returns 422 (`PAYERS_SUM_MISMATCH` / `SHARES_SUM_MISMATCH`).

## R4 · Remainders use the Largest Remainder Method

```
100,000 ₫ split 3 ways:
  floor(100000/3) = 33333 each      → total 99999, remainder 1
  give the leftover unit to the first → 33334 / 33333 / 33333
  ties go to the lower input index   → the result is ALWAYS the same for the same input
```

Implemented once in `libs/shared-money/src/lib/split.ts` (`distributeByWeights`, `splitEqually`, `computeShares`). **Don't reimplement it anywhere else.** The frontend uses it for the live preview and the backend for persistence — same function, so they never disagree.

## R5 · Balance is derived

**There is no `balance` column.** No caching. Always recompute (`calculateBalances` in `libs/shared-money/src/lib/balance.ts`):

```
balance(m) = SUM(payers.amount   WHERE member = m)   // m paid
           + SUM(payments.amount WHERE from   = m)   // m repaid
           − SUM(shares.amount   WHERE member = m)   // m benefited
           − SUM(payments.amount WHERE to     = m)   // m was repaid
```

Payments count in the group's base currency (`amountBaseMinor`).

**Global invariant: `SUM(balance of every member) === 0`.** Non-zero means a bug. `BalancesService` calls `assertBalancesSumToZero` outside production and logs `BALANCE_INVARIANT_VIOLATED` in production.

## Common mistakes

| Mistake | Consequence |
|---|---|
| TypeORM `bigint` columns come back as **strings** | `a + b` gives `"100200"` instead of `300`. Every money column **must** use `bigintTransformer`. |
| Deleting a member who still has a balance | Money vanishes, `SUM(balance) ≠ 0` forever. Blocked with 409 `MEMBER_HAS_BALANCE`. |
| Rounding each share independently | Total ≠ amount. Use R4. |
| Formatting money in many places | Use `ui-amount` / `formatMoney()` — one place only. |

## Tests are mandatory

Every change in `libs/shared-money` needs property-based tests (`fast-check`), as in `split.spec.ts`:

```ts
fc.assert(fc.property(
  fc.integer({ min: 1, max: 1_000_000_000 }),
  fc.integer({ min: 1, max: 50 }),
  (total, count) => {
    const parts = splitEqually(total, count);
    expect(sum(parts)).toBe(total);                                    // R3
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  },
));
```
