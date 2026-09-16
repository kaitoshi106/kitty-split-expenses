/**
 * Strings printed in exported PDF and Excel files. Kept separate from the web
 * app's translations, which carry hundreds of UI-only keys.
 *
 * The language arrives as `?lang=` because the user's choice lives in the
 * browser's localStorage. Money formatting is not localized here: formatMoney
 * picks the locale from the group's currency, not the reader's language.
 */

export type ExportLang = 'vi' | 'en';

/** @description Normalizes a `lang` value; anything other than `en` falls back to `vi`. */
export function toExportLang(value: unknown): ExportLang {
  return value === 'en' ? 'en' : 'vi';
}

interface ExportStrings {
  filenamePrefix: string;
  documentTitle: string;
  createdBy: string;
  colTitle: string;
  colAmount: string;
  colBy: string;
  colDate: string;
  colCreated: string;
  subPaid: string;
  subShare: string;
  balance: string;
  suggested: string;
  pays: string;
  paymentLabel: string;
  uncategorized: string;
  deletedCategory: string;
  sheetMain: string;
  sheetCategory: string;
  categoryTitle: string;
  colCategory: string;
  colPercent: string;
  totalSpent: string;
}

const STRINGS: Record<ExportLang, ExportStrings> = {
  vi: {
    filenamePrefix: 'Tong ket',
    documentTitle: 'Tổng kết',
    createdBy: 'Tạo bởi Kitty',
    colTitle: 'Nội dung',
    colAmount: 'Số tiền',
    colBy: 'Người ứng',
    colDate: 'Ngày',
    colCreated: 'Tạo lúc',
    subPaid: 'Ứng',
    subShare: 'Phần',
    balance: 'Số dư',
    suggested: 'Chuyển tiền gợi ý',
    pays: 'trả cho',
    paymentLabel: 'Chuyển tiền',
    uncategorized: 'Chưa phân loại',
    deletedCategory: 'Danh mục đã xoá',
    sheetMain: 'Tổng kết',
    sheetCategory: 'Theo danh mục',
    categoryTitle: 'Chi tiêu theo danh mục',
    colCategory: 'Danh mục',
    colPercent: 'Tỉ lệ',
    totalSpent: 'Tổng đã chi',
  },
  en: {
    filenamePrefix: 'Summary',
    documentTitle: 'Summary',
    createdBy: 'Created with Kitty',
    colTitle: 'Title',
    colAmount: 'Amount',
    colBy: 'Paid by',
    colDate: 'Date',
    colCreated: 'Created on',
    subPaid: 'Paid',
    subShare: 'Share',
    balance: 'Balance',
    suggested: 'Suggested transfers',
    pays: 'pays',
    paymentLabel: 'Transfer',
    uncategorized: 'Uncategorised',
    deletedCategory: 'Deleted category',
    sheetMain: 'Summary',
    sheetCategory: 'By category',
    categoryTitle: 'Spending by category',
    colCategory: 'Category',
    colPercent: 'Share',
    totalSpent: 'Total spent',
  },
};

/** @description Returns the export string table for a language. */
export function exportStrings(lang: ExportLang): ExportStrings {
  return STRINGS[lang];
}

/**
 * @description Formats a long date for report headers, e.g. "16 September 2026".
 * Built by hand because Intl's vi-VN output differs between ICU versions.
 * @param iso - ISO date string.
 * @param lang - Output language.
 * @returns The formatted date, or `iso` unchanged if it cannot be parsed.
 */
export function longDate(iso: string, lang: ExportLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  if (lang === 'vi') return `${day} tháng ${d.getUTCMonth() + 1}, ${year}`;
  return `${day} ${MONTHS_EN[d.getUTCMonth()]} ${year}`;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
