---
name: add-feature-screen
description: Workflow for adding a domain screen to apps/web/src/app/features/ (Overview, Expenses, Settle Up...). Covers lazy routes, reading state from GroupStore, and the loading/empty/data states every list screen must handle.
---

# Workflow: add a screen to `features/`

Use this for a screen with domain logic (Overview, Expenses, Settle Up…).
For a reusable, domain-agnostic component see [`add-ui-component`](../add-ui-component/SKILL.md).

## Before you write it

Look at the closest existing screen and match its layout: a full page uses `ui-page-header` + `<main class="… md:mx-auto md:max-w-2xl">` (e.g. `features/activity/activity-page.ts`); a tab inside the group shell renders only its content (e.g. `features/overview/overview-tab.ts`). Use the terms in [`00-project.md`](../../rules/00-project.md) for names.

## Steps

**1 · Create the folder**

```
apps/web/src/app/features/<name>/
├── <name>-page.ts     routed component (`<name>-tab.ts` for a child of group-shell)
└── <part>.ts          sub-component used only by this screen
```

A sub-component used by one screen lives **next to it**, not in `ui/` (e.g. `features/balances/balance-list.ts`). Selectors use the `app-` prefix.

**2 · Register the route — always lazy**

```ts
// apps/web/src/app/app.routes.ts
{
  path: 'g/:gid/<name>',
  canActivate: [groupTokenGuard],
  loadComponent: () => import('./features/<name>/<name>-page').then((m) => m.<Name>Page),
}
```

Use `loadComponent`, never a direct import, so each screen is its own chunk. Group routes need `groupTokenGuard`. A tab goes under the `children` of the `g/:gid` route instead and inherits the guard from its parent.

**3 · Read group data from the store**

```ts
export class OverviewTab {
  protected readonly store = inject(GroupStore);
  protected readonly i18n = inject(I18nService);

  private readonly PREVIEW_ROWS = 4;

  // Balances, settle-up and totals are computed() in the store — they update by themselves.
  protected readonly hasMore = computed(() => this.store.balanceRows().length > this.PREVIEW_ROWS);
}
```

Group-scoped data (`members`, `expenses`, `payments`, `balances`, `settleUp`, `totalSpentMinor`…) comes from `GroupStore` (`core/store/group.store.ts`). Writes that change it go through store methods, so every screen sees the change. Inject `ApiService` directly only for data that is local to one screen and not part of the store (activity log, trash, export, the pre-group join/create flows).

Never compute balances in a component. They are derived in the store via `@kitty/shared-money`.

**4 · Handle every state, not just one**

Every list screen handles loading, empty and data:

```html
@if (loading()) {
  <div class="space-y-2">
    @for (i of [1, 2, 3]; track i) {
      <div class="h-14 animate-pulse rounded-2xl bg-slate-100"></div>
    }
  </div>
} @else if (entries().length === 0) {
  <ui-empty-state icon="🕘" [title]="i18n.t('activity.empty')" [message]="i18n.t('activity.emptyHint')" />
} @else {
  @for (e of entries(); track e.id) { ... }
}
```

Tabs under group-shell get the loading skeleton from the shell (`store.loading() && !store.loaded()`), so they only need the empty and data branches.
HTTP errors are turned into a translated toast by `core/interceptors/error.interceptor.ts`; the screen catches the failure and falls back to its empty state rather than rendering its own error block.

A forgotten empty state is the most common miss — and it is exactly what a new user sees first.

**5 · Checklist**

- [ ] `OnPush` is set
- [ ] Route uses `loadComponent` (lazy) and the right guard
- [ ] Group data read from `GroupStore` signals; `ApiService` only for screen-local data
- [ ] Loading / empty / data all handled
- [ ] Money displayed through `ui-amount` (or `formatMoney` from `@kitty/shared-money`), never formatted by hand
- [ ] Every `@for` has a `track`
- [ ] Every user-visible string goes through `i18n.t()`, with keys added to both `core/i18n/translations.en.ts` and `translations.vi.ts`
- [ ] Holds up at 375px width

## Where modals live

Modals that open from several tabs (new expense, new payment, new person) live in **`features/group-shell/`** (`expense-form-modal.ts`, `payment-form-modal.ts`, `person-form-modal.ts`), not in each tab, because the FAB is shown on every tab.

A modal used by one screen only lives in that screen's folder.
