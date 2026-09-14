import { Request, Response, NextFunction } from "express";
import { SubjectService } from "../services/domain/subject.service";
import { validator } from "../common/errors/validator";
import { CreateSubjectSchema, CreateSubjectDto, UpdateSubjectSchema, UpdateSubjectDto } from "../dto/subject.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class SubjectController {
  async createSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateSubjectSchema, req.body);
      const service = new SubjectService(req.tenant!);
      const subject = await service.createSubject(dto as CreateSubjectDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(subject, "تمت إضافة المادة الدراسية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المادة");
      const dto = await validator(UpdateSubjectSchema, req.body);
      const service = new SubjectService(req.tenant!);
      const updated = await service.updateSubject(id, dto as UpdateSubjectDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات المادة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page, limit } = req.query;
      const service = new SubjectService(req.tenant!);
      const result = await service.fetchSubjects({
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة المواد الدراسية", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getSubjectDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المادة");
      const service = new SubjectService(req.tenant!);
      const details = await service.fetchSubjectDetails(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(details, "تفاصيل المادة الدراسية"));
    } catch (error) {
      next(error);
    }
  }
}
