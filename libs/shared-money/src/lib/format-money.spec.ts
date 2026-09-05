import { currencyInfo } from './currency';
import { formatMoney, minorToDecimalString } from './format-money';

/**
 * Intl separates the number and currency symbol with a no-break space (U+00A0),
 * not a regular space. Spelled out explicitly so expectations are readable.
 */
const NBSP = '\u00A0';

describe('minorToDecimalString', () => {
  it('returns the plain digits for zero-decimal currencies', () => {
    expect(minorToDecimalString(100000, 0)).toBe('100000');
    expect(minorToDecimalString(0, 0)).toBe('0');
  });

  it('inserts the decimal point for 2-digit currencies', () => {
    expect(minorToDecimalString(1050, 2)).toBe('10.50');
    expect(minorToDecimalString(123456, 2)).toBe('1234.56');
  });

  // Covers the padStart branch
  it('pads with zeros below one major unit', () => {
    expect(minorToDecimalString(5, 2)).toBe('0.05');
    expect(minorToDecimalString(50, 2)).toBe('0.50');
    expect(minorToDecimalString(0, 2)).toBe('0.00');
  });

  it('handles 3-digit currencies (BHD, KWD)', () => {
    expect(minorToDecimalString(1, 3)).toBe('0.001');
    expect(minorToDecimalString(1234, 3)).toBe('1.234');
  });

  it('always yields exactly `digits` fraction digits', () => {
    for (const digits of [2, 3]) {
      for (const minor of [0, 1, 7, 99, 100, 123456789]) {
        const out = minorToDecimalString(minor, digits);
        expect(out.split('.')[1]).toHaveLength(digits);
      }
    }
  });
});

describe('formatMoney', () => {
  // Expectations verified against Intl on Node 24; other ICU versions may differ.

  it('VND — no decimals, symbol after the number', () => {
    expect(formatMoney(100000, 'VND')).toBe(`100.000${NBSP}₫`);
  });

  it('prefixes positive values with + when signed', () => {
    expect(formatMoney(426666, 'VND', { signed: true })).toBe(`+426.666${NBSP}₫`);
  });

  it('uses U+2212 minus sign for negatives, not a hyphen', () => {
    const out = formatMoney(-233333, 'VND', { signed: true });
    expect(out).toBe(`−233.333${NBSP}₫`);
    expect(out.startsWith('−')).toBe(true); // MINUS SIGN
    expect(out.startsWith('-')).toBe(false); // HYPHEN-MINUS
  });

  it('always signs negatives, even when not signed', () => {
    expect(formatMoney(-233333, 'VND')).toBe(`−233.333${NBSP}₫`);
  });

  it('never signs zero, even when signed', () => {
    expect(formatMoney(0, 'VND', { signed: true })).toBe(`0${NBSP}₫`);
  });

  it('USD — 2 decimals, symbol before the number', () => {
    expect(formatMoney(1050, 'USD')).toBe('$10.50');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('negative USD — minus sign precedes the symbol', () => {
    expect(formatMoney(-1050, 'USD', { signed: true })).toBe('−$10.50');
  });

  it('JPY — no decimals', () => {
    expect(formatMoney(1500, 'JPY')).toBe('￥1,500');
  });

  it('EUR — de-DE swaps separators and puts the symbol after', () => {
    expect(formatMoney(123456, 'EUR')).toBe(`1.234,56${NBSP}€`);
  });

  it('treats currency codes case-insensitively', () => {
    expect(formatMoney(100000, 'vnd')).toBe(formatMoney(100000, 'VND'));
  });

  // Intl throws RangeError for '', 'US', 'VNDD', 'US$'
  it('falls back to a plain number plus code for invalid currency codes', () => {
    expect(() => formatMoney(1050, 'US')).not.toThrow();
    expect(formatMoney(1050, 'US')).toBe('10.50 US');
  });

  it('accepts unknown but well-formed 3-letter codes', () => {
    expect(() => formatMoney(1050, 'ABC')).not.toThrow();
  });
});

describe('currencyInfo', () => {
  it('returns info for known currencies', () => {
    expect(currencyInfo('VND')).toEqual({ digits: 0, locale: 'vi-VN' });
    expect(currencyInfo('USD')).toEqual({ digits: 2, locale: 'en-US' });
  });

  it('falls back to a safe default for unknown codes', () => {
    expect(currencyInfo('ZZZ').digits).toBe(2);
  });
});

describe('formatMoney — without symbol', () => {
  it('returns only the grouped number', () => {
    expect(formatMoney(300_000, 'VND', { symbol: false })).toBe('300.000');
  });

  it("keeps the currency's decimal digits", () => {
    expect(formatMoney(123_456, 'USD', { symbol: false })).toBe('1,234.56');
  });

  it('keeps the minus sign', () => {
    expect(formatMoney(-166_667, 'VND', { symbol: false })).toBe('−166.667');
  });

  it('includes the symbol by default', () => {
    expect(formatMoney(300_000, 'VND')).toBe(`300.000${NBSP}₫`);
  });
});
