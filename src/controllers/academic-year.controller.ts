import { Request, Response, NextFunction } from "express";
import { AcademicYearService } from "../services/domain/academic-year.service";
import { validator } from "../common/errors/validator";
import {
  CreateAcademicYearSchema,
  CreateAcademicYearDto,
  UpdateAcademicYearSchema,
  UpdateAcademicYearDto,
} from "../dto/academic-year.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class AcademicYearController {
  async getAcademicYears(req: Request, res: Response, next: NextFunction) {
    try {
      const departmentId = req.params.departmentId || (req.query.departmentId as string | undefined);
      const branchId = req.params.branchId || (req.query.branchId as string | undefined);

      const service = new AcademicYearService(req.tenant!);
      const years = await service.fetchAcademicYears({ branchId, departmentId });

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(years, "السنوات الدراسية"));
    } catch (error) {
      next(error);
    }
  }

  async getAcademicYearsForBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;
      Ensure.exists(branchId, "معرف الفرع الأكاديمي");

      const departmentId = req.query.departmentId as string | undefined;
      const service = new AcademicYearService(req.tenant!);
      const years = await service.fetchAcademicYearsByBranch(branchId, departmentId);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(years, "السنوات الدراسية للفرع"));
    } catch (error) {
      next(error);
    }
  }

  async createAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const { departmentId } = req.params;
      Ensure.exists(departmentId, "معرف القسم الأكاديمي");

      const dto = await validator(CreateAcademicYearSchema, req.body);
      const service = new AcademicYearService(req.tenant!);
      const year = await service.createAcademicYearForDepartment(departmentId, dto as CreateAcademicYearDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(year, "تمت إضافة السنة الدراسية للقسم بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async createAcademicYearForBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;
      Ensure.exists(branchId, "معرف الفرع الأكاديمي");

      const dto = await validator(CreateAcademicYearSchema, req.body);
      const service = new AcademicYearService(req.tenant!);
      const year = await service.createAcademicYearForBranch(branchId, dto as CreateAcademicYearDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(year, "تمت إضافة السنة الدراسية للفرع بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف السنة الدراسية");

      const dto = await validator(UpdateAcademicYearSchema, req.body);
      const service = new AcademicYearService(req.tenant!);
      const updated = await service.updateAcademicYear(id, dto as UpdateAcademicYearDto);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(updated, "تم تحديث بيانات السنة الدراسية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async deleteAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف السنة الدراسية");

      const service = new AcademicYearService(req.tenant!);
      await service.deleteAcademicYear(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success({}, "تم حذف السنة الدراسية بنجاح"));
    } catch (error) {
      next(error);
    }
  }
}
