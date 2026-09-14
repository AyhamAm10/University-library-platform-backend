import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/domain/subscription.service";
import { validator } from "../common/errors/validator";
import { CreateSubscriptionSchema, CreateSubscriptionDto } from "../dto/subscription.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class SubscriptionController {
  async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateSubscriptionSchema, req.body);
      const service = new SubscriptionService(req.tenant!);
      const subscription = await service.subscribeStudent(dto as CreateSubscriptionDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(subscription, "تم تفعيل اشتراك الطالب في الخدمة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الاشتراك");
      const service = new SubscriptionService(req.tenant!);
      const cancelled = await service.cancelSubscription(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(cancelled, "تم إلغاء الاشتراك بنجاح دون حذف السجل التاريخي"));
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, subjectId, featureType, status, timePeriodId, page, limit } = req.query;
      const service = new SubscriptionService(req.tenant!);
      const result = await service.fetchSubscriptions({
        studentId: studentId as string,
        subjectId: subjectId as string,
        featureType: featureType as string,
        status: status as string,
        timePeriodId: timePeriodId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة الاشتراكات", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }
}
