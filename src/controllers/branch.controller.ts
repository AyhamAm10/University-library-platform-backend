import { Request, Response, NextFunction } from "express";
import { BranchService } from "../services/domain/branch.service";
import { validator } from "../common/errors/validator";
import { CreateBranchSchema, CreateBranchDto, UpdateBranchSchema, UpdateBranchDto } from "../dto/branch.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class BranchController {
  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateBranchSchema, req.body);
      const service = new BranchService(req.tenant!);
      const branch = await service.createBranch(dto as CreateBranchDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(branch, "تم إنشاء الفرع الأكاديمي بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الفرع");
      const dto = await validator(UpdateBranchSchema, req.body);
      const service = new BranchService(req.tenant!);
      const updated = await service.updateBranch(id, dto as UpdateBranchDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات الفرع بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async deleteBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الفرع");
      const service = new BranchService(req.tenant!);
      await service.deleteBranch(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success({}, "تم حذف الفرع بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new BranchService(req.tenant!);
      const branches = await service.fetchBranches();
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(branches, "قائمة الفروع الأكاديمية"));
    } catch (error) {
      next(error);
    }
  }
}
