import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { buildSummaryReport, type SummaryReport } from '@kitty/shared-money';
import { IsNull, Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toCategory, toExpense, toMember, toPayment } from '../../common/mappers';
import {
  CategoryEntity, ExpenseEntity, GroupEntity, MemberEntity, PaymentEntity,
} from '../../entities';
import { type ExportLang, exportStrings } from './export-i18n';
import { buildSummaryPdf } from './pdf.builder';
import { buildSummaryXlsx } from './xlsx.builder';

export type ExportFormat = 'pdf' | 'xlsx';

export interface ExportedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * @description Loads group data and hands it to the PDF or Excel builder.
 * All figures come from `buildSummaryReport` in @kitty/shared-money, which uses
 * the same `calculateBalances` as the app, so exports always match the screen.
 */
@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(GroupEntity) private readonly groups: Repository<GroupEntity>,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
  ) {}

  /**
   * @description Builds the group report file.
   * @param groupId - Group to export.
   * @param format - Output format.
   * @param lang - Report language.
   * @returns File contents with a download filename and MIME type.
   */
  async export(
    groupId: string,
    format: ExportFormat,
    lang: ExportLang,
  ): Promise<ExportedFile> {
    const report = await this.buildReport(groupId, lang);
    const buffer = format === 'pdf'
      ? await buildSummaryPdf(report, lang)
      : await buildSummaryXlsx(report, lang);

    return { buffer, filename: filenameFor(report, format, lang), mimeType: MIME[format] };
  }

  private async buildReport(groupId: string, lang: ExportLang): Promise<SummaryReport> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Không tìm thấy nhóm');

    const [memberRows, expenseRows, paymentRows, categoryRows] = await Promise.all([
      // Member order defines column order; the id tiebreak keeps it stable
      // across exports.
      this.members.find({ where: { groupId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.expenses.find({ where: { groupId }, order: { expenseDate: 'ASC', createdAt: 'ASC' } }),
      this.payments.find({ where: { groupId }, order: { paymentDate: 'ASC', createdAt: 'ASC' } }),
      // System categories have a NULL groupId
      this.categories.find({ where: [{ groupId }, { groupId: IsNull() }] }),
    ]);

    const categoryName = new Map(categoryRows.map((c) => [c.id, toCategory(c).name]));
    const t = exportStrings(lang);

    return buildSummaryReport({
      groupName: group.name,
      currency: group.baseCurrency,
      generatedAt: new Date(),
      members: memberRows.map(toMember),
      expenses: expenseRows.map(toExpense),
      payments: paymentRows.map(toPayment),
      categoryName: (id) =>
        id === null ? t.uncategorized : (categoryName.get(id) ?? t.deletedCategory),
      paymentLabel: t.paymentLabel,
      simplifyDebts: group.simplifyDebts,
    });
  }
}

/**
 * @description Builds the download filename. Characters forbidden in Windows/macOS
 * filenames are replaced; Vietnamese diacritics are kept.
 * @returns `<prefix> <group name> <YYYY-MM-DD>.<format>`
 */
function filenameFor(
  report: SummaryReport,
  format: ExportFormat,
  lang: ExportLang,
): string {
  const safeName = report.groupName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'group';
  const day = report.generatedAt.slice(0, 10);
  return `${exportStrings(lang).filenamePrefix} ${safeName} ${day}.${format}`;
}
