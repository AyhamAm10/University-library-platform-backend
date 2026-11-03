import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { logger } from "../../logging/logger";
import { APIError, HttpStatusCode } from "./api.error";
import { HttpError, NotFoundError } from "./http.error";

/**
 * تحويل أخطاء Prisma المعروفة إلى أخطاء HTTP مفهومة بالعربية بدلاً من 500.
 */
const mapPrismaError = (error: Prisma.PrismaClientKnownRequestError): HttpError | null => {
  switch (error.code) {
    case "P2002":
      return new HttpError(HttpStatusCode.CONFLICT, "القيمة المدخلة مستخدمة مسبقاً، يرجى إدخال قيمة مختلفة");
    case "P2003":
      return new HttpError(
        HttpStatusCode.CONFLICT,
        "لا يمكن تنفيذ العملية لارتباط هذا السجل ببيانات أخرى في النظام"
      );
    case "P2025":
      return new HttpError(HttpStatusCode.NOT_FOUND, "السجل المطلوب غير موجود أو تم حذفه");
    case "P2000":
      return new HttpError(HttpStatusCode.BAD_REQUEST, "إحدى القيم المدخلة أطول من الحد المسموح");
    default:
      return null;
  }
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`المسار المطلوب غير موجود: ${req.method} ${req.path}`));
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof APIError) {
    return res.status(error.httpCode).json({
      success: false,
      code: error.code,
      message: error.message,
      description: error.description,
      error: error.name,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(error);
    if (mapped) {
      logger.warn(`[${req.method}] ${req.originalUrl} - Prisma ${error.code}: ${error.message}`);
      error = mapped;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.warn(`[${req.method}] ${req.originalUrl} - Prisma validation: ${error.message}`);
    error = new HttpError(HttpStatusCode.BAD_REQUEST, "البيانات المرسلة غير صالحة أو ناقصة");
  }

  // JSON غير صالح في جسم الطلب أو جسم أكبر من الحد المسموح
  const bodyErrorType = (error as any).type;
  if (bodyErrorType === "entity.parse.failed") {
    error = new HttpError(HttpStatusCode.BAD_REQUEST, "صيغة البيانات المرسلة غير صالحة (JSON)");
  } else if (bodyErrorType === "entity.too.large") {
    error = new HttpError(413, "حجم البيانات المرسلة أكبر من الحد المسموح");
  }

  if (error instanceof HttpError) {
    if (error.statusCode >= 500) {
      logger.error(`[${req.method}] ${req.originalUrl} - ${error.message}\n${error.stack ?? ""}`);
    } else {
      logger.warn(`[${req.method}] ${req.originalUrl} - ${error.statusCode} ${error.message}`);
    }

    return res.status(error.statusCode).json({
      success: false,
      status: error.statusCode,
      message: error.message,
      error: error.name,
      details: error.details,
    });
  }

  logger.error(`[${req.method}] ${req.originalUrl} - ${error.message}\n${error.stack ?? ""}`);

  return res.status(HttpStatusCode.INTERNAL_SERVER).json({
    success: false,
    message: "حدث خطأ غير متوقع في الخادم، يرجى المحاولة لاحقاً",
    error: process.env.NODE_ENV === "production" ? "ServerError" : error.message,
  });
};
