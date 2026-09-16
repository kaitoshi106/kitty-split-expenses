import { currencyInfo, type SummaryReport } from '@kitty/shared-money';
import { Workbook, type Worksheet } from 'exceljs';
import { type ExportLang, exportStrings, longDate } from './export-i18n';
import { COLORS, shortDate } from './report-layout';

/**
 * Excel export of the group summary, with the same layout as the PDF.
 *
 * Cells hold real numbers with a display `numFmt`, not formatted strings, so
 * users can sum and filter them in Excel.
 *
 * This is the only place minor units are divided by 10^digits: money stays in
 * integer minor units throughout, and conversion to decimals happens only at
 * this output boundary, after all calculations are done.
 */

const ARGB = {
  ink: 'FF0F172A',
  muted: 'FF64748B',
  brand: 'FF6366F1',
  brandSoft: 'FFEEF2FF',
  credit: 'FF059669',
  debit: 'FFDC2626',
  line: 'FFE2E8F0',
} as const;

/**
 * @description Renders the summary report as an Excel workbook with a main
 * sheet and a per-category sheet.
 * @param report - Precomputed report rows, totals and suggested transfers.
 * @param lang - Language for labels and dates.
 * @returns The .xlsx file contents.
 */
export async function buildSummaryXlsx(
  report: SummaryReport,
  lang: ExportLang,
): Promise<Buffer> {
  const t = exportStrings(lang);
  const wb = new Workbook();
  wb.creator = 'Kitty';
  wb.created = new Date(report.generatedAt);

  const { digits } = currencyInfo(report.currency);
  const scale = 10 ** digits;
  const numFmt = digits === 0 ? '#,##0;[Red]-#,##0' : `#,##0.${'0'.repeat(digits)};[Red]-#,##0.${'0'.repeat(digits)}`;
  const toNumber = (minor: number): number | null => (minor === 0 ? null : minor / scale);

  const sheet = wb.addWorksheet(t.sheetMain, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
  });

  const opts: NumberOpts = { numFmt, toNumber, t, lang };
  buildMainSheet(sheet, report, opts);
  buildCategorySheet(wb.addWorksheet(t.sheetCategory), report, opts);

  // exceljs types this as ArrayBuffer but returns a Node Buffer at runtime
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

interface NumberOpts {
  numFmt: string;
  toNumber: (minor: number) => number | null;
  t: ReturnType<typeof exportStrings>;
  lang: ExportLang;
}

/** @description Writes the expense/payment table, balances row and suggested transfers. */
function buildMainSheet(sheet: Worksheet, report: SummaryReport, opts: NumberOpts): void {
  const memberCount = report.memberNames.length;
  const leftCount = 5;
  const lastCol = leftCount + memberCount * 2;

  sheet.mergeCells(1, 1, 1, Math.max(lastCol, 5));
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${report.groupName} — ${longDate(report.generatedAt, opts.lang)}`;
  titleCell.font = { bold: true, size: 16, color: { argb: ARGB.ink } };

  sheet.mergeCells(2, 1, 2, Math.max(lastCol, 5));
  const subCell = sheet.getCell(2, 1);
  subCell.value = opts.t.createdBy;
  subCell.font = { size: 10, color: { argb: ARGB.muted } };

  // ── Two header rows ──
  // General columns merge vertically; each member name spans its paid/share
  // sub-columns, matching the PDF.
  const { t } = opts;
  const headers = [t.colTitle, t.colAmount, t.colBy, t.colDate, t.colCreated];
  headers.forEach((label, i) => {
    sheet.mergeCells(4, i + 1, 5, i + 1);
    const cell = sheet.getCell(4, i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: ARGB.ink } };
    cell.alignment = { vertical: 'middle' };
  });

  report.memberNames.forEach((name, i) => {
    const col = leftCount + i * 2 + 1;
    sheet.mergeCells(4, col, 4, col + 1);
    const head = sheet.getCell(4, col);
    head.value = name;
    head.font = { bold: true, color: { argb: ARGB.ink } };
    head.alignment = { horizontal: 'center', vertical: 'middle' };
    for (const [offset, label] of [[0, t.subPaid], [1, t.subShare]] as const) {
      const sub = sheet.getCell(5, col + offset);
      sub.value = label;
      sub.font = { size: 9, color: { argb: ARGB.muted } };
      sub.alignment = { horizontal: 'right' };
    }
  });

  paintRange(sheet, 4, leftCount + 1, 5, lastCol, ARGB.brandSoft);
  underline(sheet, 5, 1, lastCol, 'medium');

  // ── Data rows ──
  let rowIndex = 6;
  for (const row of report.rows) {
    const r = sheet.getRow(rowIndex);
    r.getCell(1).value = row.title;
    r.getCell(2).value = opts.toNumber(row.amountMinor);
    r.getCell(3).value = row.byName;
    r.getCell(4).value = shortDate(row.date);
    r.getCell(5).value = shortDate(row.createdOn);
    r.getCell(2).numFmt = opts.numFmt;

    if (row.kind === 'payment') {
      for (let c = 1; c <= leftCount; c += 1) {
        r.getCell(c).font = { color: { argb: ARGB.muted }, italic: true };
      }
    }

    row.cells.forEach((cell, i) => {
      const col = leftCount + i * 2 + 1;
      const paid = r.getCell(col);
      paid.value = opts.toNumber(cell.paidMinor);
      paid.numFmt = opts.numFmt;
      paid.font = { color: { argb: ARGB.credit } };

      const share = r.getCell(col + 1);
      // Negative values, not red positives, so an Excel SUM across a member's
      // columns yields the balance
      share.value = opts.toNumber(-cell.shareMinor);
      share.numFmt = opts.numFmt;
      share.font = { color: { argb: ARGB.debit } };
    });

    paintRange(sheet, rowIndex, leftCount + 1, rowIndex, lastCol, ARGB.brandSoft);
    underline(sheet, rowIndex, 1, lastCol, 'hair');
    rowIndex += 1;
  }

  // ── Balances row ──
  const totalRow = sheet.getRow(rowIndex);
  totalRow.getCell(1).value = t.balance;
  totalRow.getCell(1).font = { bold: true, color: { argb: ARGB.ink } };
  report.totalsMinor.forEach((total, i) => {
    const col = leftCount + i * 2 + 1;
    sheet.mergeCells(rowIndex, col, rowIndex, col + 1);
    const cell = sheet.getCell(rowIndex, col);
    cell.value = total / (10 ** currencyInfo(report.currency).digits);
    cell.numFmt = opts.numFmt;
    cell.alignment = { horizontal: 'right' };
    cell.font = {
      bold: true,
      color: { argb: total > 0 ? ARGB.credit : total < 0 ? ARGB.debit : ARGB.ink },
    };
  });
  paintRange(sheet, rowIndex, leftCount + 1, rowIndex, lastCol, ARGB.brandSoft);
  underline(sheet, rowIndex, 1, lastCol, 'medium');

  // ── Suggested transfers ──
  if (report.suggested.length > 0) {
    rowIndex += 2;
    const head = sheet.getCell(rowIndex, 1);
    head.value = t.suggested;
    head.font = { bold: true, size: 12, color: { argb: ARGB.ink } };
    underline(sheet, rowIndex, 1, 4, 'medium');
    rowIndex += 1;
    for (const transfer of report.suggested) {
      const r = sheet.getRow(rowIndex);
      r.getCell(1).value = transfer.fromName;
      r.getCell(2).value = t.pays;
      r.getCell(2).font = { color: { argb: ARGB.muted } };
      r.getCell(3).value = transfer.toName;
      r.getCell(4).value = opts.toNumber(transfer.amountMinor);
      r.getCell(4).numFmt = opts.numFmt;
      r.getCell(4).font = { bold: true };
      underline(sheet, rowIndex, 1, 4, 'hair');
      rowIndex += 1;
    }
  }

  sheet.getColumn(1).width = 26;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 11;
  sheet.getColumn(5).width = 11;
  for (let c = leftCount + 1; c <= lastCol; c += 1) sheet.getColumn(c).width = 13;
}

/** @description Writes the spending-by-category sheet (same data as the app's pie chart). */
function buildCategorySheet(sheet: Worksheet, report: SummaryReport, opts: NumberOpts): void {
  sheet.getCell(1, 1).value = opts.t.categoryTitle;
  sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: ARGB.ink } };

  [opts.t.colCategory, opts.t.colAmount, opts.t.colPercent].forEach((label, i) => {
    const cell = sheet.getCell(3, i + 1);
    cell.value = label;
    cell.font = { bold: true };
  });
  underline(sheet, 3, 1, 3, 'medium');

  report.byCategory.forEach((slice, i) => {
    const r = sheet.getRow(4 + i);
    r.getCell(1).value = slice.label;
    r.getCell(2).value = opts.toNumber(slice.totalMinor);
    r.getCell(2).numFmt = opts.numFmt;
    // Store a fraction with a percent format so the cell stays numeric
    r.getCell(3).value = slice.percent / 100;
    r.getCell(3).numFmt = '0%';
    underline(sheet, 4 + i, 1, 3, 'hair');
  });

  const totalRowIndex = 4 + report.byCategory.length;
  sheet.getCell(totalRowIndex, 1).value = opts.t.totalSpent;
  sheet.getCell(totalRowIndex, 1).font = { bold: true };
  sheet.getCell(totalRowIndex, 2).value = opts.toNumber(report.totalSpentMinor);
  sheet.getCell(totalRowIndex, 2).numFmt = opts.numFmt;
  sheet.getCell(totalRowIndex, 2).font = { bold: true };
  underline(sheet, totalRowIndex, 1, 3, 'medium');

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 10;
}

/** @description Fills a cell range with a solid background color. */
function paintRange(
  sheet: Worksheet, r1: number, c1: number, r2: number, c2: number, argb: string,
): void {
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      sheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
  }
}

/** @description Draws a bottom border across a row segment. */
function underline(
  sheet: Worksheet, row: number, c1: number, c2: number, style: 'medium' | 'hair',
): void {
  const color = { argb: style === 'medium' ? ARGB.brand : ARGB.line };
  for (let c = c1; c <= c2; c += 1) {
    const cell = sheet.getCell(row, c);
    cell.border = { ...cell.border, bottom: { style, color } };
  }
}
