import { Request, Response, NextFunction } from "express";
import { DepartmentService } from "../services/domain/department.service";
import { validator } from "../common/errors/validator";
import { CreateDepartmentSchema, CreateDepartmentDto, UpdateDepartmentSchema, UpdateDepartmentDto } from "../dto/department.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class DepartmentController {
  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateDepartmentSchema, req.body);
      const service = new DepartmentService(req.tenant!);
      const department = await service.createDepartment(dto as CreateDepartmentDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(department, "تم إنشاء القسم الأكاديمي بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف القسم");
      const dto = await validator(UpdateDepartmentSchema, req.body);
      const service = new DepartmentService(req.tenant!);
      const updated = await service.updateDepartment(id, dto as UpdateDepartmentDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات القسم بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف القسم");
      const service = new DepartmentService(req.tenant!);
      await service.deleteDepartment(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success({}, "تم حذف القسم بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.query;
      const service = new DepartmentService(req.tenant!);
      const departments = await service.fetchDepartmentsByBranch(branchId as string);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(departments, "قائمة الأقسام الأكاديمية"));
    } catch (error) {
      next(error);
    }
  }
}
