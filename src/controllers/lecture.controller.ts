import { Request, Response, NextFunction } from "express";
import { LectureService } from "../services/domain/lecture.service";
import { validator } from "../common/errors/validator";
import { CreateLectureSchema, CreateLectureDto, UpdateLectureSchema, UpdateLectureDto } from "../dto/lecture.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class LectureController {
  async createLecture(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateLectureSchema, req.body);
      const service = new LectureService(req.tenant!);
      const result = await service.createLecture(dto as CreateLectureDto);

      return res.status(HttpStatusCode.CREATED).json(
        ApiResponse.success(
          result.lecture,
          `تم رفع المحاضرة بنجاح وتم إتاحتها لـ ${result.notifiedSubscribersCount} طالب مشترك تلقائياً`
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async updateLecture(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المحاضرة");
      const dto = await validator(UpdateLectureSchema, req.body);
      const service = new LectureService(req.tenant!);
      const updated = await service.updateLecture(id, dto as UpdateLectureDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات المحاضرة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getLectures(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId } = req.query;
      const service = new LectureService(req.tenant!);
      const lectures = await service.fetchLectures(subjectId as string);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(lectures, "قائمة المحاضرات"));
    } catch (error) {
      next(error);
    }
  }
}
