import { Request, Response, NextFunction } from "express";
import { CourseService } from "../services/domain/course.service";
import { validator } from "../common/errors/validator";
import { CreateCourseSchema, CreateCourseDto, AddCourseLessonSchema, AddCourseLessonDto } from "../dto/course.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class CourseController {
  async createCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateCourseSchema, req.body);
      const service = new CourseService(req.tenant!);
      const course = await service.createCourse(dto as CreateCourseDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(course, "تم إنشاء الدورة التعليمية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async addLesson(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الدورة");
      const dto = await validator(AddCourseLessonSchema, req.body);
      const service = new CourseService(req.tenant!);
      const lesson = await service.addLessonToCourse(id, dto as AddCourseLessonDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(lesson, "تمت إضافة الدرس إلى الدورة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId } = req.query;
      const service = new CourseService(req.tenant!);
      const courses = await service.fetchCourses(subjectId as string);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(courses, "قائمة الدورات التعليمية"));
    } catch (error) {
      next(error);
    }
  }

  async getCourseDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الدورة");
      const service = new CourseService(req.tenant!);
      const course = await service.fetchCourseDetails(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(course, "تفاصيل ومحتويات الدورة"));
    } catch (error) {
      next(error);
    }
  }
}
