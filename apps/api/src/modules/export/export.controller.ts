import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { toExportLang } from './export-i18n';
import { ExportService, type ExportFormat } from './export.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Export')
@ApiBearerAuth('token')
@Controller('groups/:gid/export')
@UseGuards(GroupMemberGuard)
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  /**
   * @description Downloads the group report as PDF.
   * @param lang - Language chosen in the app; preferred over Accept-Language,
   * which reflects the browser rather than the user's choice. Unknown values
   * fall back to Vietnamese.
   */
  @Get('pdf')
  pdf(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Res() res: Response,
    @Query('lang') lang?: string,
  ): Promise<void> {
    return this.send(gid, 'pdf', lang, res);
  }

  /** @description Downloads the group report as an Excel workbook. */
  @Get('xlsx')
  xlsx(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Res() res: Response,
    @Query('lang') lang?: string,
  ): Promise<void> {
    return this.send(gid, 'xlsx', lang, res);
  }

  private async send(
    gid: string,
    format: ExportFormat,
    lang: string | undefined,
    res: Response,
  ): Promise<void> {
    const file = await this.exports.export(gid, format, toExportLang(lang));

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.byteLength));

    // RFC 6266: `filename=` must be ASCII, so send an ASCII fallback for old
    // browsers plus `filename*` with the UTF-8 name for modern ones.
    // D with stroke (U+0110/U+0111) has no NFD decomposition; map it by hand.
    const ascii = file.filename
      .replace(/Đ/g, 'D')
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    // Data changes often; never serve a stale report.
    res.setHeader('Cache-Control', 'no-store');

    res.end(file.buffer);
  }
}
