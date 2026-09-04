# Angular conventions (`apps/web`)

Angular 20 · standalone · signals · **zoneless** · Tailwind v4

## Three rules for EVERY component

```ts
@Component({
  selector: 'app-expense-card',
  changeDetection: ChangeDetectionStrategy.OnPush,   // 1. always
  imports: [UiAmount],                                // standalone, no NgModule
  template: `...`,
})
export class ExpenseCard {
  readonly expense = input.required<Expense>();       // 2. signal input
  readonly selected = output<string>();

  readonly myShare = computed(() =>                   // 3. derived = computed
    this.expense().shares.find(s => s.memberId === this.me())?.amountMinor ?? 0
  );
}
```

| # | Rule | Why |
|---|---|---|
| 1 | `ChangeDetectionStrategy.OnPush` | Required for zoneless rendering to be predictable |
| 2 | Mutable state → `signal()` / `input()` / `model()` | Without zone.js, only signal changes trigger a render |
| 3 | Derived data → `computed()` | Never update derived values by hand |

## Zoneless

The app uses `provideZonelessChangeDetection()` (`app.config.ts`); zone.js is not loaded. **A plain field bound in a template silently stops updating — there is no runtime error.**

Never mutate a plain field inside `setTimeout`, `subscribe`, a promise callback or a third-party callback. Write to a signal.

## The `ui/` ↔ `features/` boundary — never break it

```
ui/         Presentation only. NO Expense, Member, Group...
            Primitives only: string, number, boolean, arrays of {id, label}
features/   Domain screens. May import types from @kitty/shared-types
core/       Singletons: ApiService, GroupStore, SessionStore, guards, interceptors, i18n
```

```ts
// ❌ WRONG — ui/ knows the domain
export class UiMemberPicker {
  members = input.required<Member[]>();
}

// ✅ RIGHT — ui/ knows only the data shape
export class UiMemberPicker {
  members = input.required<{ id: string; name: string; color: string }[]>();
}
```

**The ban targets domain DATA, not pure utility functions.**

```ts
// ❌ BANNED — domain type
import { Expense } from '@kitty/shared-types';

// ✅ ALLOWED — pure presentation helper
import { formatMoney } from '@kitty/shared-money';
```

`ui-amount` importing `formatMoney` is correct: otherwise every caller would format and pass a string, and money display would scatter across the app.

## Control flow

```html
@if (loading()) { <app-skeleton /> } @else { ... }
@for (e of expenses(); track e.id) { <app-expense-card [expense]="e" /> }
@switch (item.kind) { @case ('expense') { ... } }
```

No `*ngIf`, `*ngFor`, `*ngSwitch`.

## `computed()` chains — one step each

```ts
// ✅ readable, debuggable
filtered   = computed(() => byQuery(byCategory(this.expenses())));
merged     = computed(() => mergeSorted(this.filtered(), this.payments()));
byMonth    = computed(() => groupBy(this.merged(), monthKey));

// ❌ one computed doing four jobs
everything = computed(() => { /* 40 lines */ });
```

## API: depend on the abstraction

`HttpApiService` and `MockApiService` both implement the `ApiService` abstract class (`core/api/`).
Components inject **only** `ApiService`. Switching backends is one provider line in `app.config.ts`.

Keep `MockApiService` in sync with `ApiService` — it is how the app runs without the backend.

## Displaying money

Always through `ui-amount` or `formatMoney()` from `@kitty/shared-money`.
Never `.toLocaleString()` scattered in templates.

```
balance > 0 → text-credit  "+426.666 ₫"
balance < 0 → text-debit   "−233.333 ₫"    ← U+2212 minus sign, not "-"
balance = 0 → text-neutral-muted
```

Amounts always carry `tabular-nums` so columns line up (`ui-amount` does this).

## Text

UI strings go through `core/i18n` (`translations.vi.ts`, `translations.en.ts`). Add keys to both files.

## Tailwind

Use the design tokens in `styles.css`: `brand-*`, `credit`, `debit`, `neutral-muted`, `surface`. Dark mode remaps tokens there — no hardcoded colours in templates.

Mobile-first, with **`md:` (768px) as the viewport breakpoint**; use container queries (`@2xl:` …) for component-level layout. Check at 375px and 1280px. Minimum tap target `min-h-11`.

**`ui/` components do not set their own `max-w-*`** (overlays such as `ui-modal` excepted). They fill the width they are given; the parent layout decides.

Not everything widens on desktop: **forms stay narrow** (`md:max-w-md`), **lists and dashboards widen** (`md:max-w-2xl` / `md:max-w-3xl`, multiple columns).
