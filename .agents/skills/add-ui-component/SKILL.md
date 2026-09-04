---
name: add-ui-component
description: Workflow for adding a reusable, domain-agnostic component to apps/web/src/app/ui/ (ui-button, ui-modal, ui-amount...). Covers the ui/ boundary rules and a pre-commit checklist.
---

# Workflow: add a component to `ui/`

Use this for a **reusable component with no domain knowledge** (`ui-button`, `ui-modal`…).
A component that knows about the domain belongs in a feature folder — see [`add-feature-screen`](../add-feature-screen/SKILL.md).

## Before you write it

Answer three questions:

1. What does it take as input? **Primitives only** — no `Expense`, no `Member`.
2. What events does it emit?
3. Will it really be reused in at least two places? If not, it belongs in `features/`.

## Steps

**1 · Create the file**

```
apps/web/src/app/ui/ui-<name>/ui-<name>.ts
```

One `.ts` file with an inline template (every existing `ui/` component does this). Split out an `.html` file only if the template grows past ~60 lines.

**2 · Component skeleton**

```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ui-<name>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class Ui<Name> {
  readonly variant = input<'primary' | 'secondary'>('primary');
  readonly disabled = input(false);
  readonly pressed = output<void>();

  protected readonly classes = computed(() => /* build classes from inputs */);
}
```

`ui/ui-button/ui-button.ts` is the reference pattern (a `VARIANT`/`SIZE` map plus a `classes` computed). The app is zoneless, so component state must be signals: `input()`, `output()`, `signal()`, `computed()`.

**3 · Check the boundary**

```bash
# Must return nothing
grep -rn "@kitty/shared-types" apps/web/src/app/ui/
```

Any hit means the boundary is broken: move the domain type out and accept primitives instead.
Cross-cutting services such as `I18nService` (for built-in labels like "Close") are fine; `GroupStore` and feature code are not. `ui-receipt-viewer` injects `ApiService` — an existing exception, not a precedent.

**4 · Add it to the UI Gallery**

Add the component's variants to the `/ui` route (`features/ui-gallery/ui-gallery-page.ts`). A broken variant should show up there **before** it breaks a real screen.

**5 · Checklist**

- [ ] `OnPush` is set
- [ ] No domain types imported
- [ ] Uses the design tokens in `apps/web/src/styles.css` (`brand-500`, `credit`, `debit`, `surface`…), no hard-coded colours — dark mode works by remapping those tokens
- [ ] Touch target `min-h-11` (44px)
- [ ] Holds up at 375px width
- [ ] Keyboard accessible (Tab, Enter; Esc for overlays)
- [ ] User-visible text comes from inputs or `I18nService`, never hard-coded

## Naming

| | |
|---|---|
| Folder | `ui-amount/` |
| File | `ui-amount.ts` |
| Class | `UiAmount` |
| Selector | `ui-amount` (ESLint allows only the `ui` and `app` prefixes) |

Directives follow the same folder rule with an attribute selector, e.g. `ui/numeric-input/numeric-input.directive.ts` (`input[uiNumeric]`).

## Existing components

Check `apps/web/src/app/ui/` before adding one — something like `ui-select`, `ui-switch`, `ui-segmented-tabs`, `ui-member-picker` or `ui-currency-input` may already do the job.
