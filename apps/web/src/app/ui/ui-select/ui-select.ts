import {
  ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, model, viewChild,
} from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * @description Styled wrapper around a native `<select>`, keeping the OS picker on mobile
 * and built-in accessibility. The native arrow cannot be repositioned, so it is hidden
 * with `appearance-none` and replaced by a non-interactive SVG chevron.
 */
@Component({
  selector: 'ui-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <select
        #el
        class="min-h-11 w-full appearance-none rounded-xl border border-slate-200
               bg-surface py-2 pl-3 pr-10 text-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        (change)="value.set($any($event.target).value || null)"
      >
        @if (placeholder()) {
          <option value="" disabled>{{ placeholder() }}</option>
        } @else if (value() === null) {
          <!--
            Hidden empty option for a null value without a placeholder. Otherwise the
            browser displays the first option while the state is still null.
          -->
          <option value="" hidden></option>
        }
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>

      <span
        class="pointer-events-none absolute inset-y-0 right-3 grid place-items-center
               text-slate-400"
        aria-hidden="true"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  `,
})
export class UiSelect {
  readonly options = input.required<SelectOption[]>();
  /** Two-way selected value; null when nothing is selected. */
  readonly value = model<string | null>(null);
  readonly placeholder = input('');

  private readonly el = viewChild.required<ElementRef<HTMLSelectElement>>('el');

  constructor() {
    /**
     * Sync the DOM value after render instead of binding `[value]`: setting it before the
     * @for options exist makes the browser fall back to the first option silently.
     * afterRenderEffect guarantees the options are in the DOM; reading `options()`
     * re-applies the value when the list changes.
     */
    afterRenderEffect(() => {
      const current = this.value() ?? '';
      this.options();
      const el = this.el().nativeElement;
      if (el.value !== current) el.value = current;
    });
  }
}
