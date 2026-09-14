import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/domain/auth.service";
import { validator } from "../common/errors/validator";
import { LoginSchema, LoginDto } from "../dto/auth.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(LoginSchema, req.body);
      const authService = new AuthService();
      const result = await authService.login(dto as LoginDto);

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(
          {
            user: result.user,
            accessToken: result.accessToken,
          },
          "تم تسجيل الدخول بنجاح"
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const authService = new AuthService();
      const user = await authService.getMe(req.user!.id);
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(user, "بيانات المستخدم"));
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie("refreshToken");
      return res.status(HttpStatusCode.OK).json(ApiResponse.success({}, "تم تسجيل الخروج بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
