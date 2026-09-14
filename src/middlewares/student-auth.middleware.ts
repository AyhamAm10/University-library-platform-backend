import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Environment } from "../config/environment";
import { prisma } from "../config/prisma";
import { UnauthorizedError, ForbiddenError } from "../common/errors/http.error";
import { ErrorMessages } from "../common/errors/ErrorMessages";
import { StudentJwtPayload } from "../services/domain/student-auth.service";

export const studentAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lang = (req.headers["accept-language"] as any) || "ar";
    req.lang = lang;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(new UnauthorizedError(ErrorMessages.generateErrorMessage("user", "unauthorized", lang)));
    }

    const tokenParts = authHeader.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return next(new UnauthorizedError(ErrorMessages.generateErrorMessage("user", "unauthorized", lang)));
    }

    const accessToken = tokenParts[1];
    let decoded: StudentJwtPayload;

    try {
      decoded = jwt.verify(accessToken, Environment.JWT_ACCESS_SECRET) as StudentJwtPayload;
    } catch (err: any) {
      return next(new UnauthorizedError("جلسة الدخول منتهية الصلاحية أو غير صالحة"));
    }

    if (!decoded.studentId || decoded.role !== "STUDENT") {
      return next(new UnauthorizedError("تصريح الدخول غير صالح لحسابات الطلاب"));
    }

    const student = await prisma.student.findUnique({
      where: { id: decoded.studentId },
    });

    if (!student) {
      return next(new UnauthorizedError("حساب الطالب غير موجود"));
    }

    if (!student.isActive) {
      return next(new ForbiddenError("هذا الحساب غير مفعل"));
    }

    // Authoritative Server-Side Device Binding Check
    const incomingDeviceId = (req.headers["x-device-id"] as string) || decoded.deviceId;
    if (student.boundDeviceId && incomingDeviceId && student.boundDeviceId !== incomingDeviceId) {
      return next(new ForbiddenError("هذا الحساب مستخدم على جهاز آخر بالفعل"));
    }

    req.student = student;
    req.user = {
      id: student.id,
      phone: student.phone,
      fullName: student.fullName,
      role: "STUDENT",
      libraryId: student.libraryId,
    };

    return next();
  } catch (error) {
    next(error);
  }
};
