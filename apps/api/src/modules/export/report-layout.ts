import { formatMoney } from '@kitty/shared-money';

/**
 * Layout constants and cell formatters shared by the PDF and Excel builders,
 * so both reports stay visually consistent.
 */

/** Palette mirrored from the web app's styles.css. */
export const COLORS = {
  ink: '#0F172A',
  muted: '#64748B',
  brand: '#6366F1',
  brandSoft: '#EEF2FF',
  credit: '#059669',
  debit: '#DC2626',
  line: '#E2E8F0',
} as const;

/**
 * Fixed columns left of the per-member columns. `key` maps to the
 * colTitle/colAmount/... translation keys.
 */
export const LEFT_COLUMNS = [
  { key: 'title', width: 150, align: 'left' },
  { key: 'amount', width: 90, align: 'right' },
  { key: 'by', width: 82, align: 'left' },
  { key: 'date', width: 60, align: 'center' },
  { key: 'created', width: 60, align: 'center' },
] as const;

export type LeftColumnKey = (typeof LEFT_COLUMNS)[number]['key'];

/** Width of one sub-cell (paid / owed share); each member column spans two. */
export const SUB_WIDTH = 74;
export const MEMBER_WIDTH = SUB_WIDTH * 2;
export const LEFT_WIDTH = LEFT_COLUMNS.reduce((s, c) => s + c.width, 0);

/**
 * @description Formats a date as `d/m/yy` for narrow table columns.
 * @param value - `YYYY-MM-DD` or a full ISO timestamp.
 * @returns The short date, or `value` unchanged if it cannot be parsed.
 */
export function shortDate(value: string): string {
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`;
}

/**
 * @description Formats an amount for a table cell: no currency symbol, empty for zero.
 * @param minor - Amount in minor units.
 * @param signed - Show the sign instead of the absolute value.
 */
export function cellText(minor: number, currency: string, signed = false): string {
  if (minor === 0) return '';
  return formatMoney(signed ? minor : Math.abs(minor), currency, {
    symbol: false,
    signed,
  });
}

/** @description Formats an unsigned amount with its currency symbol. */
export function amountText(minor: number, currency: string): string {
  return formatMoney(minor, currency);
}

/** @description Formats a total row amount with currency symbol and explicit sign. */
export function totalText(minor: number, currency: string): string {
  return formatMoney(minor, currency, { signed: true });
}
