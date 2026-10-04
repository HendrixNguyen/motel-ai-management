export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "MAGIC_LINK_EXPIRED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "READING_CONFLICT"
  | "PERIOD_ALREADY_SENT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXTERNAL_SERVICE_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  MAGIC_LINK_EXPIRED: 401,
  OTP_INVALID: 401,
  OTP_EXPIRED: 401,
  RATE_LIMITED: 429,
  READING_CONFLICT: 409,
  PERIOD_ALREADY_SENT: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXTERNAL_SERVICE_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError("VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Chưa đăng nhập") {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "Không có quyền truy cập") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(message = "Không tìm thấy") {
    return new AppError("NOT_FOUND", message);
  }
  static conflict(message: string, details?: Record<string, unknown>) {
    return new AppError("CONFLICT", message, details);
  }
  static rateLimited(message: string, retryAfterSeconds: number) {
    return new AppError("RATE_LIMITED", message, { retryAfterSeconds });
  }
}
