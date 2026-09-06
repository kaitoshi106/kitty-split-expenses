import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

// A single `variant` axis controls appearance. Each entry defines background,
// text, hover and focus ring together so switching variants changes every state.
const VARIANT = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500',
  secondary:
    'bg-surface text-slate-700 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger: 'bg-debit text-white hover:bg-red-700 focus-visible:ring-debit',
} as const;

const SIZE = {
  // sm is below the 44px touch target; reserve it for dense secondary actions.
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-sm gap-2',
  lg: 'min-h-12 px-5 text-base gap-2',
} as const;

/**
 * @description Button with variants, sizes and a loading state that also disables it.
 */
@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [class]="classes()"
      [disabled]="isDisabled()"
      [attr.aria-busy]="loading() ? 'true' : null"
    >
      @if (loading()) {
        <svg
          class="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
          />
        </svg>
      }
      <ng-content />
    </button>
  `,
  host: {
    /**
     * `full` must also apply to the host: an inline host shrinks to its content,
     * so `w-full` on the inner button alone would not stretch. On the host it fills
     * the row when stacked and splits space evenly inside a flex row.
     */
    '[class.block]': 'full()',
    '[class.w-full]': 'full()',
  },
})
export class UiButton {
  readonly variant = input<keyof typeof VARIANT>('primary');
  readonly size = input<keyof typeof SIZE>('md');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly full = input(false);

  /** Defaults to 'button' so buttons inside forms do not submit unless asked to. */
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  /** A loading button is also disabled. */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.loading(),
  );

  protected readonly classes = computed(() =>
    [
      'inline-flex select-none items-center justify-center rounded-xl font-medium',
      'transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      VARIANT[this.variant()],
      SIZE[this.size()],
      this.full() ? 'w-full' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
