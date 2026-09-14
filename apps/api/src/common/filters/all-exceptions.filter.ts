import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * @description Normalizes every error to `{ statusCode, error, message, details? }`
 * so clients need a single error handler.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // AppError bodies are already in the target shape
      if (typeof body === 'object' && body !== null && 'error' in body) {
        res.status(status).json(body);
        return;
      }

      // ValidationPipe errors: { message: string[], error, statusCode }
      const raw = body as { message?: string | string[] };
      const message = Array.isArray(raw.message)
        ? raw.message.join('; ')
        : (raw.message ?? exception.message);

      res.status(status).json({
        statusCode: status,
        error: status === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR',
        message,
        details: Array.isArray(raw.message) ? { issues: raw.message } : undefined,
      });
      return;
    }

    // Unexpected error: log the full stack, expose nothing beyond a generic message
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'Có lỗi xảy ra ở máy chủ',
    });
  }
}
