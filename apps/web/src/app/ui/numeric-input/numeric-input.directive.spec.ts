import { sanitizeNumeric } from './numeric-input.directive';

const int = { decimals: 0 };
const dec2 = { decimals: 2 };
const pct = { decimals: 2, max: 100 };

describe('sanitizeNumeric — integers only', () => {
  it('strips letters and special characters', () => {
    expect(sanitizeNumeric('abc', int)).toBe('');
    expect(sanitizeNumeric('90a000', int)).toBe('90000');
    expect(sanitizeNumeric('90.000', int)).toBe('90000');
  });

  it('strips characters that input type=number would accept', () => {
    // 'e', '+' and '-' are why money fields avoid <input type="number">.
    expect(sanitizeNumeric('1e5', int)).toBe('15');
    expect(sanitizeNumeric('-100', int)).toBe('100');
    expect(sanitizeNumeric('+100', int)).toBe('100');
  });
});

describe('sanitizeNumeric — with decimals', () => {
  it('keeps exactly one decimal separator', () => {
    // "1.2.3" would make Number() return NaN and silently fall back to 0.
    expect(sanitizeNumeric('1.2.3', dec2)).toBe('1.23');
    expect(sanitizeNumeric('33,33,33', dec2)).toBe('33.33');
    expect(sanitizeNumeric('1,,2', dec2)).toBe('1.2');
    expect(sanitizeNumeric('...', dec2)).toBe('.');
  });

  it('always produces a parseable number', () => {
    for (const raw of ['1.2.3', '33,33,33', '1,,2', '9.9.9.9', '0.0.0']) {
      const out = sanitizeNumeric(raw, dec2);
      expect(Number.isNaN(Number(out))).toBe(false);
    }
  });

  it('converts commas to dots', () => {
    expect(sanitizeNumeric('33,5', dec2)).toBe('33.5');
  });

  it('truncates extra decimal digits', () => {
    expect(sanitizeNumeric('33.9999', dec2)).toBe('33.99');
    expect(sanitizeNumeric('1.23456', { decimals: 4 })).toBe('1.2345');
  });

  it('allows partial input such as "12."', () => {
    expect(sanitizeNumeric('12.', dec2)).toBe('12.');
    expect(Number('12.')).toBe(12);
  });
});

describe('sanitizeNumeric — upper bound (max)', () => {
  it('caps percentages at 100', () => {
    expect(sanitizeNumeric('500', pct)).toBe('100');
    expect(sanitizeNumeric('100', pct)).toBe('100');
    expect(sanitizeNumeric('99.99', pct)).toBe('99.99');
  });

  it('clamps extra digits typed at the cap', () => {
    // The numeric value stays 100, so the signal does not change and Angular
    // would not update the field; the directive must write back to the DOM.
    expect(sanitizeNumeric('1000', pct)).toBe('100');
  });

  it('caps weights at 999', () => {
    expect(sanitizeNumeric('99999', { decimals: 2, max: 999 })).toBe('999');
  });
});
