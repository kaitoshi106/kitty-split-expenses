import { Directive, input, output } from '@angular/core';

export interface SanitizeOptions {
  /** Allowed decimal digits; 0 means integers only. */
  decimals: number;
  /** Upper bound; larger values are clamped to it. */
  max?: number;
}

/**
 * @description Sanitizes raw user input into a valid numeric string: strips non-numeric
 * characters, keeps only the first decimal separator (so the result never parses to NaN),
 * truncates extra decimals, then clamps to `max`.
 * @param text - Raw input value.
 * @param options - Allowed decimals and optional upper bound.
 * @returns A string that `Number()` can parse; partial input such as "12." is preserved.
 */
export function sanitizeNumeric(text: string, options: SanitizeOptions): string {
  const { decimals, max } = options;

  // 1. Keep only digits and separators.
  let out = decimals > 0 ? text.replace(/[^\d.,]/g, '') : text.replace(/[^\d]/g, '');
  if (!out) return '';

  if (decimals > 0) {
    // 2. Normalize commas to dots and keep only the first one.
    out = out.replace(/,/g, '.');
    const first = out.indexOf('.');
    if (first !== -1) {
      out = out.slice(0, first + 1) + out.slice(first + 1).replace(/\./g, '');
    }

    // 3. Truncate extra decimal digits.
    const dot = out.indexOf('.');
    if (dot !== -1 && out.length - dot - 1 > decimals) {
      out = out.slice(0, dot + 1 + decimals);
    }
  }

  if (max !== undefined && out !== '' && out !== '.') {
    const value = Number(out);
    // Partial input like "12." still compares correctly: Number("12.") === 12.
    if (Number.isFinite(value) && value > max) return String(max);
  }

  return out;
}

/**
 * @description Restricts an `<input>` to numeric text:
 *
 *   <input [uiNumeric]="2" [uiNumericMax]="100" (uiNumericChange)="set($event)" />
 *
 * Writes the sanitized value straight back to the element. Parsing only in a component
 * handler is not enough: if the numeric value is unchanged ("10a" -> 10), the bound
 * signal does not change and Angular leaves the invalid characters in the DOM.
 * `type="number"` is avoided because it accepts 'e', '+', '-' and changes on mouse wheel.
 */
@Directive({
  selector: 'input[uiNumeric]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'onInput($event)',
  },
})
export class UiNumeric {
  /** Allowed decimal digits; 0 means integers only. */
  readonly uiNumeric = input(0);

  /** Upper bound, e.g. 100 for a percentage field. */
  readonly uiNumericMax = input<number | undefined>(undefined);

  /** Emits the sanitized string; listen to this instead of `(input)`. */
  readonly uiNumericChange = output<string>();

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const before = el.value;
    const caret = el.selectionStart ?? before.length;
    const opts: SanitizeOptions = { decimals: this.uiNumeric(), max: this.uiNumericMax() };

    const cleaned = sanitizeNumeric(before, opts);

    if (cleaned !== before) {
      // Assigning value moves the caret to the end; restore it by counting
      // the characters kept before the original caret position.
      const keptBefore = sanitizeNumeric(before.slice(0, caret), opts).length;
      el.value = cleaned;
      const next = Math.min(cleaned.length, Math.max(0, keptBefore));
      el.setSelectionRange(next, next);
    }

    this.uiNumericChange.emit(cleaned);
  }
}
