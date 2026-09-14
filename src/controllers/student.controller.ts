import { Request, Response, NextFunction } from "express";
import { StudentService } from "../services/domain/student.service";
import { validator } from "../common/errors/validator";
import { CreateStudentSchema, CreateStudentDto, UpdateStudentSchema, UpdateStudentDto } from "../dto/student.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class StudentController {
  async createStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateStudentSchema, req.body);
      const service = new StudentService(req.tenant!);
      const student = await service.createStudent(dto as CreateStudentDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(student, "تم تسجيل بيانات الطالب بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الطالب");
      const dto = await validator(UpdateStudentSchema, req.body);
      const service = new StudentService(req.tenant!);
      const updated = await service.updateStudent(id, dto as UpdateStudentDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات الطالب بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, branchId, departmentId, page, limit } = req.query;
      const service = new StudentService(req.tenant!);
      const result = await service.fetchStudents({
        search: search as string,
        branchId: branchId as string,
        departmentId: departmentId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة الطلاب", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getStudentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الطالب");
      const service = new StudentService(req.tenant!);
      const details = await service.fetchStudentDetails(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(details, "تفاصيل وسجل الطالب الأكاديمي"));
    } catch (error) {
      next(error);
    }
  }

  async generateActivationCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الطالب");
      const service = new StudentService(req.tenant!);
      const result = await service.generateActivationCode(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(result, "تم توليد رمز تفعيل جديد للطالب"));
    } catch (error) {
      next(error);
    }
  }

  async unbindDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الطالب");
      const service = new StudentService(req.tenant!);
      const result = await service.unbindDevice(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(result, result.message));
    } catch (error) {
      next(error);
    }
  }
}
