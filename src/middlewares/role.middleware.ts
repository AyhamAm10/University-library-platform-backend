import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../common/errors/http.error";

export const checkRole = (allowedRoles: (UserRole | "STUDENT")[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError("يرجى تسجيل الدخول أولاً"));
      }

      if (!allowedRoles.includes(req.user.role)) {
        return next(new ForbiddenError("ليس لديك صلاحية للوصول إلى هذه الخدمة"));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
