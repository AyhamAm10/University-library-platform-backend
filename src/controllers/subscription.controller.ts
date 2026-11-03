import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/domain/subscription.service";
import { SubscriptionArchiveService } from "../services/domain/subscription-archive.service";
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
      const { subjectId, featureType, status, timePeriodId, page, limit } = req.query;
      let studentId = req.query.studentId as string;

      // If caller is a student, restrict queries strictly to their own subscriptions
      if (req.tenant?.role === "STUDENT" && req.tenant?.userId) {
        studentId = req.tenant.userId;
      }

      const service = new SubscriptionService(req.tenant!);
      const result = await service.fetchSubscriptions({
        studentId,
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

  async getArchive(req: Request, res: Response, next: NextFunction) {
    try {
      const { timePeriodId, studentId, featureType, search, page, limit } = req.query;

      const service = new SubscriptionArchiveService(req.tenant!);
      const result = await service.fetchArchive({
        timePeriodId: timePeriodId as string,
        studentId: studentId as string,
        featureType: featureType as string,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "أرشيف الاشتراكات", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getArchivedPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new SubscriptionArchiveService(req.tenant!);
      const periods = await service.getArchivedPeriodsSummary();
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(periods, "الدورات المؤرشفة"));
    } catch (error) {
      next(error);
    }
  }
}
