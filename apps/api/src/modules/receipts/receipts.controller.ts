import {
  Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Receipt } from '@kitty/shared-types';
import type { Response } from 'express';
import { CurrentMember, type MemberContext } from '../../common/decorators/current-member.decorator';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { MAX_RECEIPT_BYTES, ReceiptsService } from './receipts.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Receipts')
@ApiBearerAuth('token')
@Controller('groups/:gid/receipts')
@UseGuards(GroupMemberGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  /**
   * @description Uploads a receipt image. The file is buffered in memory and
   * written to disk by the service only after type and size checks pass;
   * multer's diskStorage would write rejected uploads to disk first.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_BYTES } }))
  upload(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Receipt> {
    return this.receipts.upload(gid, me.memberId, file);
  }

  /**
   * @description Streams a receipt image. Served through an authenticated
   * endpoint rather than a public static folder, since receipts can contain
   * personal data.
   */
  @Get(':rid')
  async download(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('rid', ParseUUIDPipe) rid: string,
    @Res() res: Response,
  ): Promise<void> {
    const { receipt, stream } = await this.receipts.openStream(gid, rid);
    res.setHeader('Content-Type', receipt.mimeType);
    res.setHeader('Content-Length', String(receipt.sizeBytes));
    // `private` keeps shared proxies from caching another user's receipt
    res.setHeader('Cache-Control', 'private, max-age=86400');
    stream.pipe(res);
  }

  @Delete(':rid')
  @HttpCode(204)
  remove(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('rid', ParseUUIDPipe) rid: string,
  ): Promise<void> {
    return this.receipts.remove(gid, rid);
  }
}
