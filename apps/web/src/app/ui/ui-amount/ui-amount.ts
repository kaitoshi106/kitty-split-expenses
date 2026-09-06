import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// ui/ must not depend on domain types; a pure formatting helper is allowed.
import { formatMoney } from '@kitty/shared-money';

const SIZE = {
  sm: 'text-sm',
  md: 'text-base font-semibold',
  lg: 'text-2xl font-bold',
} as const;

/**
 * @description Displays a money amount (bigint-derived minor units) formatted for its currency.
 */
@Component({
  selector: 'ui-amount',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Inline element so amounts can sit within running text.
  template: `<span [class]="classes()">{{ text() }}</span>`,
})
export class UiAmount {
  /** Amount in minor units, e.g. 100000 = 100.000 ₫. */
  readonly minor = input.required<number>();

  /** ISO 4217 currency code, e.g. 'VND', 'USD', 'EUR', 'JPY'. */
  readonly currency = input.required<string>();

  /**
   * Shows the +/− sign and colors by sign (for balances). Off for plain totals.
   * Sign and color are one input because they never vary independently.
   */
  readonly signed = input(false);

  readonly size = input<keyof typeof SIZE>('md');

  protected readonly text = computed(() =>
    formatMoney(this.minor(), this.currency(), { signed: this.signed() }),
  );

  /**
   * App-wide sign colors: positive = credit (the group owes this member),
   * negative = debit (the member owes the group), zero = settled.
   */
  protected readonly toneClass = computed(() => {
    if (!this.signed()) return ''; // unsigned amounts inherit the parent text color
    const value = this.minor();
    if (value > 0) return 'text-credit';
    if (value < 0) return 'text-debit';
    return 'text-neutral-muted';
  });

  protected readonly classes = computed(() =>
    [
      // Fixed-width digits keep amount columns aligned.
      'tabular-nums',
      SIZE[this.size()],
      this.toneClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );
}
