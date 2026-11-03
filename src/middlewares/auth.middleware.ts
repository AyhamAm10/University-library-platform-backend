import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Environment } from "../config/environment";
import { prisma } from "../config/prisma";
import { UnauthorizedError, ForbiddenError } from "../common/errors/http.error";
import { ErrorMessages } from "../common/errors/ErrorMessages";

export const authMiddleware = async (
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
    let decoded: any;

    try {
      decoded = jwt.verify(accessToken, Environment.JWT_ACCESS_SECRET);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        // Attempt silent refresh via refresh token cookie
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
          return next(new UnauthorizedError("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً"));
        }

        try {
          const refreshDecoded = jwt.verify(
            refreshToken,
            Environment.JWT_REFRESH_SECRET
          ) as { userId: string };

          const user = await prisma.user.findUnique({
            where: { id: refreshDecoded.userId },
          });

          if (!user || !user.isActive) {
            return next(new ForbiddenError("الحساب غير موجود أو موقوف"));
          }

          const newAccessToken = jwt.sign(
            { userId: user.id, role: user.role, libraryId: user.libraryId },
            Environment.JWT_ACCESS_SECRET,
            { expiresIn: "1h" }
          );

          res.setHeader("Authorization", `Bearer ${newAccessToken}`);
          decoded = { userId: user.id, role: user.role, libraryId: user.libraryId };
        } catch {
          return next(new UnauthorizedError("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً"));
        }
      } else {
        return next(new UnauthorizedError("رمز الدخول غير صالح، يرجى تسجيل الدخول مجدداً"));
      }
    }

    // Check if token belongs to a Student
    if (decoded?.role === "STUDENT" && decoded?.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: decoded.studentId },
      });

      if (!student || !student.isActive) {
        return next(new ForbiddenError("حساب الطالب غير موجود أو غير مفعل"));
      }

      req.student = student;
      req.user = {
        id: student.id,
        email: null,
        phone: student.phone,
        fullName: student.fullName,
        role: "STUDENT",
        libraryId: student.libraryId,
      };

      return next();
    }

    const userId = decoded?.userId;
    if (!userId) {
      return next(new UnauthorizedError("رمز الدخول غير صالح"));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return next(new ForbiddenError("الحساب موقوف أو غير مفعل"));
    }

    req.user = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      libraryId: user.libraryId,
    };

    return next();
  } catch (error) {
    next(error);
  }
};
