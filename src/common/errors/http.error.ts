export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "طلب غير صالح", details?: any) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "غير مصرح، يرجى تسجيل الدخول", details?: any) {
    super(401, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "ليس لديك صلاحية لتنفيذ هذه العملية", details?: any) {
    super(403, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "العنصر المطلوب غير موجود", details?: any) {
    super(404, message, details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "حدث خطأ داخلي في الخادم", details?: any) {
    super(500, message, details);
  }
}
