import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Receipt } from '@kitty/shared-types';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toReceipt } from '../../common/mappers';
import { ReceiptEntity } from '../../entities';

const EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

/**
 * @description Detects the image type from the file's magic bytes, the only
 * trusted source. The client's Content-Type is unreliable both ways: iOS sends
 * HEIC as heic, heif, heif-sequence or nothing, and any file can be labeled
 * image/png.
 *
 * Signatures: JPEG FF D8 FF; PNG 89 50 4E 47 0D 0A 1A 0A; WebP "RIFF"...."WEBP";
 * HEIF/HEIC/AVIF "ftyp" at bytes 4-8 (ISO base media file format).
 * @param buf - File contents.
 * @returns The detected MIME type, or null if unsupported.
 */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF'
    && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    // HEIF brands; AVIF shares the same container
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif)$/.test(brand)) return 'image/heic';
  }
  return null;
}

/** Upload limit (10 MB). The web client compresses images first, so real uploads are much smaller. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly uploadDir: string;

  constructor(
    config: ConfigService,
    @InjectRepository(ReceiptEntity) private readonly receipts: Repository<ReceiptEntity>,
  ) {
    // Only used to read legacy receipts stored on disk; new uploads go to the DB.
    // Resolved to an absolute path so it does not depend on the working directory.
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR') ?? 'apps/api/uploads');
  }

  /**
   * @description Validates and stores a receipt image in the database.
   * @param file - Multer in-memory upload.
   * @throws {AppError} When the file is missing, not a supported image, or too large.
   */
  async upload(
    groupId: string,
    memberId: string,
    file: Express.Multer.File | undefined,
  ): Promise<Receipt> {
    if (!file) {
      throw AppError.badRequest('FILE_REQUIRED', 'Chưa chọn ảnh');
    }
    const mimeType = sniffImageMime(file.buffer);
    if (!mimeType) {
      throw AppError.badRequest(
        'FILE_TYPE_NOT_ALLOWED',
        'Chỉ nhận ảnh JPG, PNG, WEBP hoặc HEIC',
        { mimeType: file.mimetype || '(không khai)' },
      );
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw AppError.badRequest('FILE_TOO_LARGE', 'Ảnh vượt quá 10MB', {
        sizeBytes: file.size,
        maxBytes: MAX_RECEIPT_BYTES,
      });
    }

    // Generate the stored name; never build paths from `originalname`
    // (path traversal).
    const filename = `${randomUUID()}${EXTENSION[mimeType] ?? extname(file.originalname)}`;

    const entity = this.receipts.create({
      groupId,
      filename,
      data: file.buffer,
      // Truncated to the column length; kept for display only
      originalName: file.originalname.slice(0, 255),
      // Store the sniffed type; the download endpoint serves it as Content-Type
      mimeType,
      sizeBytes: file.size,
      uploadedByMemberId: memberId,
    });
    await this.receipts.save(entity);

    this.logger.log(`Received receipt ${entity.id} (${Math.round(file.size / 1024)}KB)`);
    return toReceipt(entity);
  }

  /**
   * @description Opens a stream over a receipt's bytes, from the database or,
   * for legacy rows, from disk. Scoping the query by `groupId` is a second line
   * of defense behind GroupMemberGuard.
   * @throws {AppError} When the receipt does not exist or its bytes are missing.
   */
  async openStream(groupId: string, receiptId: string) {
    // `data` is select:false; this is the only query that loads it
    const receipt = await this.receipts
      .createQueryBuilder('r')
      .addSelect('r.data')
      .where('r.id = :receiptId', { receiptId })
      .andWhere('r.groupId = :groupId', { groupId })
      .getOne();
    if (!receipt) throw AppError.notFound('RECEIPT_NOT_FOUND', 'Không tìm thấy ảnh');

    if (receipt.data) {
      return { receipt, stream: Readable.from(receipt.data) };
    }

    // No bytes in the DB: legacy row stored on disk
    const path = join(this.uploadDir, receipt.filename);
    if (!existsSync(path)) {
      // Usually caused by a disk cleanup or a changed UPLOAD_DIR
      this.logger.error(`Receipt bytes missing from both DB and disk: ${path}`);
      throw AppError.notFound('RECEIPT_FILE_MISSING', 'Ảnh không còn trên máy chủ');
    }

    return { receipt, stream: createReadStream(path) };
  }

  /** @description Deletes a receipt and, for legacy rows, its file on disk. */
  async remove(groupId: string, receiptId: string): Promise<void> {
    const receipt = await this.receipts.findOne({ where: { id: receiptId, groupId } });
    if (!receipt) throw AppError.notFound('RECEIPT_NOT_FOUND', 'Không tìm thấy ảnh');

    await this.receipts.delete({ id: receiptId });
    // Clean up legacy files on disk; ignore if absent
    await unlink(join(this.uploadDir, receipt.filename)).catch(() => undefined);
  }
}
