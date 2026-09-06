import { TestBed } from '@angular/core/testing';
import { UiCurrencyInput } from './ui-currency-input';
import { parseToMinor, sanitize } from './ui-currency-input';

describe('sanitize — filters characters while typing', () => {
  it('strips letters', () => {
    expect(sanitize('abc', 'VND')).toBe('');
    expect(sanitize('100abc000', 'VND')).toBe('100000');
  });

  it('strips special characters and whitespace', () => {
    expect(sanitize('100 000đ', 'VND')).toBe('100000');
    expect(sanitize('$10.50', 'USD')).toBe('10.50');
    expect(sanitize('1e5', 'VND')).toBe('15');
    expect(sanitize('-100', 'VND')).toBe('100');
  });

  it('normalizes commas to dots', () => {
    // Comma is a common decimal separator; normalizing early leaves parseToMinor one case.
    expect(sanitize('10,50', 'USD')).toBe('10.50');
  });

  it('treats dots as thousands separators for VND (no decimals)', () => {
    // With digits = 0 up to 3 digits are allowed after the separator so users can
    // type "100.000"; parseToMinor drops the separator.
    expect(sanitize('100.000', 'VND')).toBe('100.000');
  });

  it('keeps only one separator', () => {
    expect(sanitize('1.2.3', 'USD')).toBe('1.23');
  });
});

describe('parseToMinor', () => {
  it('VND — no decimals, dot is a thousands separator', () => {
    expect(parseToMinor('100.000', 'VND')).toBe(100000);
    expect(parseToMinor('100000', 'VND')).toBe(100000);
    expect(parseToMinor('', 'VND')).toBe(0);
  });

  it('USD — 2 decimal digits', () => {
    expect(parseToMinor('10.50', 'USD')).toBe(1050);
    expect(parseToMinor('10,50', 'USD')).toBe(1050); // comma accepted
    expect(parseToMinor('10.5', 'USD')).toBe(1050); // zero-padded
    expect(parseToMinor('10', 'USD')).toBe(1000);
    expect(parseToMinor('0.05', 'USD')).toBe(5);
  });

  it('returns 0 rather than NaN for letters', () => {
    expect(parseToMinor(sanitize('abc', 'VND'), 'VND')).toBe(0);
    expect(parseToMinor(sanitize('abc', 'USD'), 'USD')).toBe(0);
  });
});

/**
 * Focus must rebuild the editable text from `minor`; a stale `raw` would resurface
 * an old value after the parent resets the field.
 */
describe('UiCurrencyInput — focus rebuilds text from the value', () => {
  function mount(minor: number, currency = 'VND') {
    const fixture = TestBed.createComponent(UiCurrencyInput);
    fixture.componentRef.setInput('currency', currency);
    fixture.componentRef.setInput('minor', minor);
    fixture.detectChanges();
    return {
      fixture,
      input: fixture.nativeElement.querySelector('input') as HTMLInputElement,
    };
  }

  it('stays empty on focus after the parent resets to 0', () => {
    const { fixture, input } = mount(250_000);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.value).toBe('250000'); // editing the existing value

    input.dispatchEvent(new Event('blur'));
    fixture.componentRef.setInput('minor', 0); // parent resets when the modal closes
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('keeps the existing value on focus when editing an expense', () => {
    const { fixture, input } = mount(500_000);
    expect(input.value).toBe(`500.000${' '}₫`);

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.value).toBe('500000');
  });

  it('restores all decimal digits for fractional currencies', () => {
    const { fixture, input } = mount(123_456, 'USD');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.value).toBe('1234.56');
  });
});
