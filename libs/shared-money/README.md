# shared-money

Framework-free money logic shared by the web and API apps.

- `split` — splits an amount into shares (equal, exact, percent, weight) using the largest remainder method.
- `balance` — derives member balances and settle-up transfers (simplified or direct debts).
- `format-money` / `currency` — locale-aware formatting from integer minor units.
- `report` — builds the group summary used for PDF/Excel export.

Invariants: amounts are integer minor units; shares and payers each sum to the expense amount; all balances sum to zero.

## Tests

```bash
pnpm nx test shared-money
```
