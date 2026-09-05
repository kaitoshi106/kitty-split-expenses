import { currencyInfo } from './currency';

/** U+2212 MINUS SIGN rather than '-': it is digit-width, so tabular-nums columns stay aligned. */
const MINUS = '−';

export interface FormatMoneyOptions {
  /** Always show a sign (+ or −) for non-zero values, e.g. for balances. */
  signed?: boolean;
  /** `false` omits the currency symbol ("300.000"), e.g. for export table cells. */
  symbol?: boolean;
}

/**
 * A cached formatter plus whether it renders the currency symbol itself.
 * The decimal fallback does not, so formatMoney appends the code.
 */
interface CachedFormatter {
  fmt: Intl.NumberFormat;
  hasCurrencySymbol: boolean;
}

/** Intl.NumberFormat construction is expensive; cached by "locale|currency|digits". */
const formatterCache = new Map<string, CachedFormatter>();

/** Symbol-less formatters keyed by "locale|digits"; exports call this once per cell. */
const plainCache = new Map<string, Intl.NumberFormat>();

function getPlainFormatter(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}|${digits}`;
  const cached = plainCache.get(key);
  if (cached) return cached;
  const fmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  plainCache.set(key, fmt);
  return fmt;
}

function getFormatter(
  locale: string,
  currency: string,
  digits: number,
): CachedFormatter {
  const key = `${locale}|${currency}|${digits}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  let result: CachedFormatter;
  try {
    result = {
      fmt: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
      hasCurrencySymbol: true,
    };
  } catch {
    // Intl throws RangeError unless `currency` is three ASCII letters (e.g. '', 'US$').
    // Fall back to a plain decimal so bad data never breaks rendering.
    result = {
      fmt: new Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
      hasCurrencySymbol: false,
    };
  }

  formatterCache.set(key, result);
  return result;
}

/**
 * @description Converts a non-negative minor-unit integer to a decimal string using
 * string slicing only, so money never passes through floating-point division
 * (1050, 2 → "10.50"; 5, 2 → "0.05").
 * @param minorAbs - Non-negative amount in minor units; the sign is handled by formatMoney.
 * @param digits - Number of minor-unit decimals for the currency.
 * @returns A numeric string accepted by Intl.NumberFormat.format().
 */
export function minorToDecimalString(
  minorAbs: number,
  digits: number,
): `${number}` {
  // Intl's format() is typed to take `${number}`; the result is always digits
  // plus at most one dot, so the assertion is safe.
  if (digits === 0) return String(minorAbs) as `${number}`;
  const s = String(minorAbs).padStart(digits + 1, '0');
  return `${s.slice(0, -digits)}.${s.slice(-digits)}` as `${number}`;
}

/**
 * @description Formats a minor-unit amount for display. The single formatter used
 * by both frontend and backend.
 *
 *   formatMoney(100000, 'VND')                   → "100.000 ₫"
 *   formatMoney(-233333, 'VND', { signed: true })→ "−233.333 ₫"
 *   formatMoney(1050, 'USD')                     → "$10.50"
 *
 * @param minor - Amount in minor units.
 * @param currency - ISO 4217 code, case-insensitive.
 * @param opts - Sign and symbol options.
 * @returns The localized string; zero is never signed.
 */
export function formatMoney(
  minor: number,
  currency: string,
  opts: FormatMoneyOptions = {},
): string {
  const code = currency.toUpperCase();
  const { digits, locale } = currencyInfo(code);

  // Format the absolute value and add the sign ourselves; Intl's negative
  // formatting varies by locale (hyphen, parentheses).
  const abs = Math.abs(minor);
  const decimal = minorToDecimalString(abs, digits);

  // format() accepts a numeric string (ES2023), avoiding precision loss on large values.
  const wantSymbol = opts.symbol !== false;
  const { fmt, hasCurrencySymbol } = getFormatter(locale, code, digits);
  let body = wantSymbol
    ? fmt.format(decimal)
    : getPlainFormatter(locale, digits).format(decimal);

  // The decimal fallback has no symbol, so append the code.
  if (wantSymbol && !hasCurrencySymbol) body = `${body} ${code}`;

  // Zero is never signed, even with `signed`.
  let sign = '';
  if (minor < 0) {
    sign = MINUS;
  } else if (minor > 0 && opts.signed) {
    sign = '+';
  }

  return sign + body;
}
