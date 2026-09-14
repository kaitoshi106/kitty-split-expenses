import { HttpException } from '@nestjs/common';

/**
 * @description Domain error carrying a stable machine-readable `code`.
 * Clients branch on `error` (the code), never on the localized `message`.
 */
export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super({ statusCode: status, error: code, message, details }, status);
  }

  static badRequest(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(400, code, message, details);
  }
  static unauthorized(code: string, message: string) {
    return new AppError(401, code, message);
  }
  static forbidden(code: string, message: string) {
    return new AppError(403, code, message);
  }
  static notFound(code: string, message: string) {
    return new AppError(404, code, message);
  }
  static conflict(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(409, code, message, details);
  }
  /** 422: well-formed input that violates a business rule. */
  static unprocessable(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(422, code, message, details);
  }
}
