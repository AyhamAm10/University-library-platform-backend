import { Request, Response, NextFunction } from "express";
import { StudentAuthService } from "../services/domain/student-auth.service";
import { validator } from "../common/errors/validator";
import {
  StudentRegisterSchema,
  StudentRegisterDto,
  StudentLoginSchema,
  StudentLoginDto,
  StudentActivateSchema,
  StudentActivateDto,
  StudentRefreshSchema,
  StudentRefreshDto,
} from "../dto/student-auth.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";

export class StudentAuthController {
  async getAcademicStructure(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new StudentAuthService();
      const structure = await service.getAcademicStructure();

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(structure, "الهيكل الأكاديمي للمكتبات والمعاهد"));
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = (await validator(StudentRegisterSchema, req.body)) as StudentRegisterDto;
      const service = new StudentAuthService();
      const result = await service.register(dto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(result, result.message));
    } catch (error) {
      next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceId = req.body.deviceId || (req.headers["x-device-id"] as string);
      const dto = (await validator(StudentActivateSchema, {
        ...req.body,
        deviceId,
      })) as StudentActivateDto;

      const service = new StudentAuthService();
      const result = await service.activate(dto);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, result.message));
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceId = req.body.deviceId || (req.headers["x-device-id"] as string);
      const dto = (await validator(StudentLoginSchema, {
        ...req.body,
        deviceId,
      })) as StudentLoginDto;

      const service = new StudentAuthService();
      const result = await service.login(dto);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تم تسجيل الدخول بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceId = req.body.deviceId || (req.headers["x-device-id"] as string);
      const dto = (await validator(StudentRefreshSchema, {
        ...req.body,
        deviceId,
      })) as StudentRefreshDto;

      const service = new StudentAuthService();
      const result = await service.refresh(dto);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تم تجديد الجلسة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const service = new StudentAuthService();
      const profile = await service.getMe(req.student!.id, deviceId);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(profile, "بيانات الطالب"));
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success({}, "تم تسجيل الخروج بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
