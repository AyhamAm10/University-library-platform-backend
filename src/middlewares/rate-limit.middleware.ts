import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";

/**
 * معالج موحد لرفض الطلبات المتجاوزة للحد المسموح برسالة عربية.
 */
const buildLimiter = (options: Partial<Options> & { message: string }) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...options,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        status: 429,
        message: options.message,
        error: "TooManyRequestsError",
      });
    },
  });

/**
 * حد عام لكل واجهات الـ API لحماية الخادم من الإغراق.
 */
export const globalRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: "عدد الطلبات كبير جداً، يرجى الانتظار قليلاً ثم المحاولة مجدداً",
});

/**
 * حد صارم لمسارات تسجيل الدخول والتفعيل لمنع تخمين كلمات المرور ورموز التفعيل.
 * المحاولات الناجحة لا تُحتسب.
 */
export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "تم تجاوز عدد محاولات الدخول المسموح بها، يرجى المحاولة بعد 15 دقيقة",
});

/**
 * حد لإنشاء الحسابات الجديدة لمنع التسجيل الآلي العشوائي.
 */
export const registerRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "تم تجاوز عدد محاولات إنشاء الحساب المسموح بها، يرجى المحاولة لاحقاً",
});

/**
 * حد لتجديد الجلسات.
 */
export const refreshRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "عدد طلبات تجديد الجلسة كبير جداً، يرجى المحاولة لاحقاً",
});
