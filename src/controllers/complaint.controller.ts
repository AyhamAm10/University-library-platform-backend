import { Request, Response, NextFunction } from "express";
import { ComplaintService } from "../services/domain/complaint.service";
import { validator } from "../common/errors/validator";
import {
  CreateComplaintSchema,
  CreateComplaintDto,
  UpdateComplaintStatusSchema,
  UpdateComplaintStatusDto,
} from "../dto/complaint.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";
import { BadRequestError, ForbiddenError } from "../common/errors/http.error";
import { ComplaintStatus } from "@prisma/client";

export class ComplaintController {
  async createComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateComplaintSchema, req.body);
      const service = new ComplaintService(req.tenant!);

      let studentId: string | undefined;
      if (req.tenant?.role === "STUDENT") {
        studentId = req.tenant.userId;
      } else {
        studentId = req.body.studentId;
      }

      if (!studentId) {
        throw new BadRequestError("معرف الطالب مطلوب لتقديم الشكوى");
      }

      const complaint = await service.createComplaint(
        studentId,
        dto as CreateComplaintDto
      );

      return res
        .status(HttpStatusCode.CREATED)
        .json(
          ApiResponse.success(
            complaint,
            "تم إرسال الشكوى بنجاح وسيتم متابعتها من قبل الإدارة"
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async getComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      let studentId = req.query.studentId as string | undefined;

      // If caller is student, strictly restrict to their own complaints
      if (req.tenant?.role === "STUDENT" && req.tenant?.userId) {
        studentId = req.tenant.userId;
      }

      const service = new ComplaintService(req.tenant!);
      const result = await service.fetchComplaints({
        studentId,
        status: status as ComplaintStatus | undefined,
        search: search as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة الشكاوى", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getComplaintById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الشكوى");

      const service = new ComplaintService(req.tenant!);
      const complaint = await service.getComplaintById(id);
      Ensure.exists(complaint, "complaint", "الشكوى غير موجودة");

      // If student, check ownership
      if (req.tenant?.role === "STUDENT" && complaint!.studentId !== req.tenant.userId) {
        throw new ForbiddenError("ليس لديك صلاحية لعرض هذه الشكوى");
      }

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(complaint, "تفاصيل الشكوى"));
    } catch (error) {
      next(error);
    }
  }

  async updateComplaintStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الشكوى");

      const dto = await validator(UpdateComplaintStatusSchema, req.body);
      const service = new ComplaintService(req.tenant!);
      const result = await service.updateComplaintStatus(
        id,
        dto as UpdateComplaintStatusDto
      );

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(result, "تم تحديث حالة الشكوى بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async deleteComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الشكوى");

      const service = new ComplaintService(req.tenant!);
      await service.deleteComplaint(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(null, "تم حذف الشكوى بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
