import { Request, Response, NextFunction } from "express";
import { SubscriptionRequestService } from "../services/domain/subscription-request.service";
import { validator } from "../common/errors/validator";
import {
  CreateSubscriptionRequestSchema,
  CreateSubscriptionRequestDto,
  ReviewSubscriptionRequestSchema,
  ReviewSubscriptionRequestDto,
} from "../dto/subscription-request.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";
import { BadRequestError } from "../common/errors/http.error";

export class SubscriptionRequestController {
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateSubscriptionRequestSchema, req.body);
      const service = new SubscriptionRequestService(req.tenant!);

      let studentId = dto.studentId;
      if (req.tenant?.role === "STUDENT") {
        studentId = req.tenant.userId;
      }

      if (!studentId) {
        throw new BadRequestError("معرف الطالب مطلوب لتقديم الطلب");
      }

      const request = await service.createRequest(dto as CreateSubscriptionRequestDto, studentId);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(request, "تم تقديم طلب الاشتراك بنجاح وسيتم تدقيقه من قبل الإدارة"));
    } catch (error) {
      next(error);
    }
  }

  async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, featureType, status, timePeriodId, page, limit } = req.query;
      let studentId = req.query.studentId as string;

      // If caller is student, strictly limit to their own requests
      if (req.tenant?.role === "STUDENT" && req.tenant?.userId) {
        studentId = req.tenant.userId;
      }

      const service = new SubscriptionRequestService(req.tenant!);
      const result = await service.fetchRequests({
        studentId,
        subjectId: subjectId as string,
        featureType: featureType as string,
        status: status as string,
        timePeriodId: timePeriodId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة طلبات الاشتراك", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف طلب الاشتراك");

      const dto = req.body?.notes ? await validator(ReviewSubscriptionRequestSchema, req.body) : {};
      const service = new SubscriptionRequestService(req.tenant!);
      const result = await service.approveRequest(id, (dto as ReviewSubscriptionRequestDto)?.notes || undefined);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تمت الموافقة على طلب الاشتراك وتفعيله بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف طلب الاشتراك");

      const dto = req.body?.notes ? await validator(ReviewSubscriptionRequestSchema, req.body) : {};
      const service = new SubscriptionRequestService(req.tenant!);
      const result = await service.rejectRequest(id, (dto as ReviewSubscriptionRequestDto)?.notes || undefined);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تم رفض طلب الاشتراك بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
