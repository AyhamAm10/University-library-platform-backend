import { Request, Response, NextFunction } from "express";
import { SummaryService } from "../services/domain/summary.service";
import { validator } from "../common/errors/validator";
import { CreateSummaryMaterialSchema, CreateSummaryMaterialDto, UpdateSummaryMaterialSchema, UpdateSummaryMaterialDto } from "../dto/summary.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class SummaryController {
  async createSummaryMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateSummaryMaterialSchema, req.body);
      const service = new SummaryService(req.tenant!);
      const summary = await service.createSummaryMaterial(dto as CreateSummaryMaterialDto, req.file);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(summary, "تمت إضافة الملخص بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateSummaryMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الملخص");
      const dto = await validator(UpdateSummaryMaterialSchema, req.body);
      const service = new SummaryService(req.tenant!);
      const updated = await service.updateSummaryMaterial(id, dto as UpdateSummaryMaterialDto, req.file);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات الملخص بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async deleteSummaryMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الملخص");
      const service = new SummaryService(req.tenant!);
      const result = await service.deleteSummaryMaterial(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(result, "تم حذف الملخص بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getSummaryMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId } = req.query;
      const service = new SummaryService(req.tenant!);
      const summaries = await service.fetchSummaryMaterials(subjectId as string);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(summaries, "قائمة الملخصات"));
    } catch (error) {
      next(error);
    }
  }
}
