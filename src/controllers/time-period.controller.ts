import { Request, Response, NextFunction } from "express";
import { TimePeriodService } from "../services/domain/time-period.service";
import { validator } from "../common/errors/validator";
import {
  CreateTimePeriodSchema,
  CreateTimePeriodDto,
  CopyContentSchema,
  CopyContentDto,
  CleanPeriodSchema,
} from "../dto/time-period.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class TimePeriodController {
  async createPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateTimePeriodSchema, req.body);
      const service = new TimePeriodService(req.tenant!);
      const period = await service.createPeriod(dto as CreateTimePeriodDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(period, "تم إنشاء الفترة الزمنية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async activatePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الفترة الزمنية");
      const service = new TimePeriodService(req.tenant!);
      const activated = await service.activatePeriod(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(activated, "تم تفعيل الفترة الزمنية وأرشفة الفترة السابقة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new TimePeriodService(req.tenant!);
      const periods = await service.getPeriods();
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(periods, "قائمة الفترات الزمنية"));
    } catch (error) {
      next(error);
    }
  }

  async getCurrentActivePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new TimePeriodService(req.tenant!);
      const active = await service.getCurrentActivePeriod();
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(active, "الفترة الزمنية النشطة حالياً"));
    } catch (error) {
      next(error);
    }
  }

  async copyContent(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CopyContentSchema, req.body);
      const service = new TimePeriodService(req.tenant!);
      const copied = await service.copyContentToCurrentPeriod(dto as CopyContentDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(copied, "تم نسخ المحتوى وإتاحته في الفترة النشطة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async cleanPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الفترة الزمنية");
      await validator(CleanPeriodSchema, req.body);

      const service = new TimePeriodService(req.tenant!);
      const result = await service.cleanOldPeriod(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تم تنظيف وحذف بيانات الفترة القديمة بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
