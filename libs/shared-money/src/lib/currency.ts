/**
 * @description Display metadata for a currency.
 * `digits` is the number of minor-unit decimals; `locale` drives separators and
 * symbol placement (vi-VN → "100.000 ₫", en-US → "$100,000.00").
 */
export interface CurrencyInfo {
  digits: number;
  locale: string;
}

/**
 * @description Supported currencies. Minor-unit digits vary (VND/JPY 0, USD/EUR 2,
 * BHD/KWD 3), so never hardcode `/ 100`.
 */
const CURRENCIES: Record<string, CurrencyInfo> = {
  VND: { digits: 0, locale: 'vi-VN' },
  USD: { digits: 2, locale: 'en-US' },
  EUR: { digits: 2, locale: 'de-DE' },
  JPY: { digits: 0, locale: 'ja-JP' },
};

/** Used for unknown codes: this is a display path, so degrade instead of throwing. */
const FALLBACK: CurrencyInfo = { digits: 2, locale: 'en-US' };

/**
 * @description Looks up display metadata for a currency code, case-insensitively.
 * @param code - ISO 4217 code.
 * @returns The currency's info, or a 2-digit en-US fallback for unknown codes.
 */
export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES[code.toUpperCase()] ?? FALLBACK;
}

/** @description Supported currency codes, e.g. for a currency picker. */
export function currencyCodes(): string[] {
  return Object.keys(CURRENCIES);
}
