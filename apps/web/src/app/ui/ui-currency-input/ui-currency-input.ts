import { ChangeDetectionStrategy, Component, computed, input, model, signal, inject } from '@angular/core';
import { currencyInfo, formatMoney, minorToDecimalString } from '@kitty/shared-money';
import { sanitizeNumeric } from '../numeric-input/numeric-input.directive';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Money input bound to an integer minor-unit value; edits raw text while
 * focused and shows the formatted amount on blur. Uses a text input with a decimal
 * inputmode because `type="number"` accepts 'e', '+', '-' and changes on mouse wheel.
 */
@Component({
  selector: 'ui-currency-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="text"
      inputmode="decimal"
      autocomplete="off"
      [class]="classes()"
      [value]="display()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || i18n.t('common.amount')"
      [attr.data-autofocus]="autofocus() ? '' : null"
      (input)="onInput($event)"
      (blur)="onBlur()"
      (focus)="onFocus()"
    />
  `,
})
export class UiCurrencyInput {
  protected readonly i18n = inject(I18nService);

  /** Two-way value in integer minor units. */
  readonly minor = model<number>(0);
  readonly currency = input('VND');

  /** `md` for a primary form field, `sm` for inline use inside list rows. */
  readonly size = input<'sm' | 'md'>('md');
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  /**
   * Marks the inner `<input>` as ui-modal's initial focus target (the host element
   * itself is not focusable).
   */
  readonly autofocus = input(false);

  protected readonly classes = computed(() =>
    [
      'rounded-xl border border-slate-200 text-right tabular-nums',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
      this.size() === 'sm'
        ? 'min-h-10 w-28 px-2 text-sm'
        : 'min-h-12 w-full px-3 text-lg font-semibold',
    ].join(' '),
  );

  protected readonly focused = signal(false);
  private readonly raw = signal('');

  /** Raw text while focused, formatted amount otherwise. */
  protected readonly display = computed(() => {
    if (this.focused()) return this.raw();
    const value = this.minor();
    return value ? formatMoney(value, this.currency()) : '';
  });

  /**
   * @description Sanitizes on every keystroke, updates `minor`, and restores the caret
   * position after rewriting the field (assigning `value` moves the caret to the end).
   */
  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const before = input.value;
    const caret = input.selectionStart ?? before.length;

    const cleaned = sanitize(before, this.currency());

    this.raw.set(cleaned);
    this.minor.set(parseToMinor(cleaned, this.currency()));

    if (cleaned !== before) {
      // Shift the caret back by the number of characters removed before it.
      const removedBeforeCaret =
        before.slice(0, caret).length - sanitize(before.slice(0, caret), this.currency()).length;
      const next = Math.max(0, caret - removedBeforeCaret);
      input.value = cleaned;
      input.setSelectionRange(next, next);
    }
  }

  /**
   * @description Rebuilds the editable text from `minor` on every focus. The parent can
   * write `minor` (reset to 0, or load an expense for editing), so a cached `raw` would
   * otherwise resurface stale text or hide the current value. Shown without thousands
   * separators to keep mid-string edits simple.
   */
  protected onFocus(): void {
    const value = Math.abs(this.minor());
    const { digits } = currencyInfo(this.currency());
    this.raw.set(value ? minorToDecimalString(value, digits) : '');
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.focused.set(false);
  }
}

/**
 * @description Sanitizes money input for a currency. Separators are allowed even for
 * zero-decimal currencies (VND, JPY), where they act as thousands separators and are
 * dropped by `parseToMinor`.
 * @param text - Raw input value.
 * @param currency - ISO 4217 code.
 * @returns Sanitized text.
 */
export function sanitize(text: string, currency: string): string {
  return sanitizeNumeric(text, { decimals: currencyInfo(currency).digits || 3 });
}

/**
 * @description Parses user text into integer minor units without floating-point math.
 *
 *   "100.000"  VND (0 digits) -> 100000
 *   "10.50"    USD (2 digits) -> 1050
 *   "10,5"     USD            -> 1050
 * @param text - User input.
 * @param currency - ISO 4217 code.
 * @returns Amount in minor units; 0 for empty or non-numeric input.
 */
export function parseToMinor(text: string, currency: string): number {
  const { digits } = currencyInfo(currency);
  // Keep digits and separators only.
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  if (digits === 0) {
    // No decimals: every separator is a thousands separator.
    return Number(cleaned.replace(/[.,]/g, '')) || 0;
  }

  // The decimal separator is the last '.' or ',' followed by 1..digits digits.
  const match = cleaned.match(new RegExp(`^(.*)[.,](\\d{1,${digits}})$`));
  if (!match) {
    const whole = Number(cleaned.replace(/[.,]/g, '')) || 0;
    return whole * 10 ** digits;
  }
  const whole = Number(match[1].replace(/[.,]/g, '')) || 0;
  const frac = match[2].padEnd(digits, '0');
  return whole * 10 ** digits + Number(frac);
}
