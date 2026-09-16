import { join } from 'node:path';
import type { SummaryReport } from '@kitty/shared-money';
import PDFDocument from 'pdfkit';
import { type ExportLang, exportStrings, longDate } from './export-i18n';
import {
  COLORS, LEFT_COLUMNS, LEFT_WIDTH, MEMBER_WIDTH, SUB_WIDTH, type LeftColumnKey,
  amountText, cellText, shortDate, totalText,
} from './report-layout';

/**
 * PDF export of the group summary table.
 *
 * Roboto (Apache 2.0) is embedded because the standard PDF fonts bundled with
 * pdfkit have no Vietnamese glyphs; pdfkit subsets it, so files stay small.
 *
 * Each member is a column, so page width grows with the member count while the
 * height stays A4 landscape and the table paginates.
 */

const MARGIN = 36;
const PAGE_HEIGHT = 595; // A4 landscape
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 26;
const FONT_SIZE = 8.5;

const FONT_DIR = join(__dirname, 'assets', 'fonts');

/**
 * @description Renders the summary report as a PDF.
 * @param report - Precomputed report rows, totals and suggested transfers.
 * @param lang - Language for labels and dates.
 * @returns The PDF file contents.
 */
export function buildSummaryPdf(report: SummaryReport, lang: ExportLang): Promise<Buffer> {
  const t = exportStrings(lang);
  const memberCount = report.memberNames.length;
  const tableWidth = LEFT_WIDTH + memberCount * MEMBER_WIDTH;
  const pageWidth = Math.max(842, MARGIN * 2 + tableWidth);

  const doc = new PDFDocument({
    size: [pageWidth, PAGE_HEIGHT],
    margin: MARGIN,
    // Pages are added manually so the header logic lives in startPage only
    autoFirstPage: false,
    info: { Title: `${report.groupName} — ${t.documentTitle}`, Creator: 'Kitty' },
  });

  doc.registerFont('body', join(FONT_DIR, 'Roboto-Regular.ttf'));
  doc.registerFont('bold', join(FONT_DIR, 'Roboto-Bold.ttf'));

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const tableLeft = MARGIN;
  const memberLeft = tableLeft + LEFT_WIDTH;
  const bottomLimit = PAGE_HEIGHT - MARGIN - ROW_HEIGHT;
  let y = 0;

  /** Draws single-line text in the current row, truncated with an ellipsis instead of wrapping. */
  const text = (
    value: string, x: number, width: number,
    align: 'left' | 'right' | 'center',
    opts: { font?: 'body' | 'bold'; color?: string; size?: number } = {},
  ): void => {
    if (!value) return;
    doc
      .font(opts.font ?? 'body')
      .fontSize(opts.size ?? FONT_SIZE)
      .fillColor(opts.color ?? COLORS.ink)
      // lineBreak:false is required; otherwise long titles wrap and silently
      // overlap the next row.
      .text(value, x, y + (ROW_HEIGHT - (opts.size ?? FONT_SIZE)) / 2 - 1, {
        width, align, lineBreak: false, ellipsis: true,
      });
  };

  const drawTableHeader = (): void => {
    // Tinted background separates the member block from the general columns
    doc
      .rect(memberLeft, y, memberCount * MEMBER_WIDTH, HEADER_HEIGHT)
      .fill(COLORS.brandSoft);

    let x = tableLeft;
    const labels: Record<LeftColumnKey, string> = {
      title: t.colTitle, amount: t.colAmount, by: t.colBy,
      date: t.colDate, created: t.colCreated,
    };
    for (const col of LEFT_COLUMNS) {
      // Same +4 inset as data rows so headers align
      text(labels[col.key], x + 4, col.width - 8, col.align, { font: 'bold' });
      x += col.width;
    }
    for (const name of report.memberNames) {
      text(name, x, MEMBER_WIDTH - 8, 'center', { font: 'bold' });
      x += MEMBER_WIDTH;
    }

    y += HEADER_HEIGHT;
    doc
      .moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
      .lineWidth(1.4).strokeColor(COLORS.brand).stroke();
  };

  const startPage = (withTitle: boolean): void => {
    doc.addPage();
    y = MARGIN;
    if (withTitle) {
      doc.font('bold').fontSize(18).fillColor(COLORS.ink)
        .text(`${report.groupName} — ${longDate(report.generatedAt, lang)}`, MARGIN, y, {
          width: tableWidth, lineBreak: false, ellipsis: true,
        });
      y += 24;
      doc.font('body').fontSize(9.5).fillColor(COLORS.muted)
        .text(t.createdBy, MARGIN, y, { width: tableWidth, lineBreak: false });
      y += 30;
    }
    drawTableHeader();
  };

  startPage(true);

  for (const row of report.rows) {
    if (y > bottomLimit) startPage(false);

    doc.rect(memberLeft, y, memberCount * MEMBER_WIDTH, ROW_HEIGHT).fill(COLORS.brandSoft);

    let x = tableLeft;
    const values: Record<LeftColumnKey, string> = {
      title: row.title,
      amount: cellText(row.amountMinor, report.currency),
      by: row.byName,
      date: shortDate(row.date),
      created: shortDate(row.createdOn),
    };
    for (const col of LEFT_COLUMNS) {
      text(values[col.key], x + 4, col.width - 8, col.align, {
        // Payments are not spending; mute them to set them apart
        color: row.kind === 'payment' ? COLORS.muted : COLORS.ink,
      });
      x += col.width;
    }

    for (const cell of row.cells) {
      text(cellText(cell.paidMinor, report.currency), x + 4, SUB_WIDTH - 8, 'right',
        { color: COLORS.credit });
      text(cellText(-cell.shareMinor, report.currency, true), x + SUB_WIDTH + 4,
        SUB_WIDTH - 8, 'right', { color: COLORS.debit });
      x += MEMBER_WIDTH;
    }

    y += ROW_HEIGHT;
    doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
      .lineWidth(0.5).strokeColor(COLORS.line).stroke();
  }

  // ── Totals row ──
  // Outside the loop, so it needs its own page-break check or it can be drawn
  // past the bottom edge.
  if (y > bottomLimit - ROW_HEIGHT) startPage(false);

  doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
    .lineWidth(1.4).strokeColor(COLORS.brand).stroke();
  doc.rect(memberLeft, y, memberCount * MEMBER_WIDTH, ROW_HEIGHT + 4).fill(COLORS.brandSoft);

  text(t.balance, tableLeft + 4, LEFT_COLUMNS[0].width - 8, 'left', { font: 'bold' });
  let tx = memberLeft;
  for (const total of report.totalsMinor) {
    text(totalText(total, report.currency), tx + 4, MEMBER_WIDTH - 8, 'right', {
      font: 'bold',
      color: total > 0 ? COLORS.credit : total < 0 ? COLORS.debit : COLORS.ink,
    });
    tx += MEMBER_WIDTH;
  }
  y += ROW_HEIGHT + 4;
  doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
    .lineWidth(1.4).strokeColor(COLORS.brand).stroke();

  drawSuggested();

  doc.end();
  return done;

  /** Draws the suggested transfers that settle all balances. */
  function drawSuggested(): void {
    if (report.suggested.length === 0) return;

    y += 28;
    // Keep at least the heading and two rows together (60pt) on one page
    if (y > bottomLimit - 60) {
      startPage(false);
      y += 12;
    }

    const width = 330;
    doc.font('bold').fontSize(11).fillColor(COLORS.ink)
      .text(t.suggested, MARGIN, y, { width, lineBreak: false });
    y += 18;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y)
      .lineWidth(1.4).strokeColor(COLORS.brand).stroke();

    for (const transfer of report.suggested) {
      text(transfer.fromName, MARGIN + 4, 100, 'left');
      text(t.pays, MARGIN + 108, 50, 'left', { color: COLORS.muted });
      text(transfer.toName, MARGIN + 162, 90, 'left');
      // Unsigned: this is an amount to pay, not a balance
      text(amountText(transfer.amountMinor, report.currency), MARGIN + 256, width - 260, 'right',
        { font: 'bold' });
      y += ROW_HEIGHT;
      doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y)
        .lineWidth(0.5).strokeColor(COLORS.line).stroke();
    }
  }
}
