import { Request, Response, NextFunction } from "express";
import { GoldService } from "../services/domain/gold.service";
import { validator } from "../common/errors/validator";
import { CreateGoldMaterialSchema, CreateGoldMaterialDto, UpdateGoldMaterialSchema, UpdateGoldMaterialDto } from "../dto/gold.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class GoldController {
  async createGoldMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateGoldMaterialSchema, req.body);
      const service = new GoldService(req.tenant!);
      const material = await service.createGoldMaterial(dto as CreateGoldMaterialDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(material, "تمت إضافة الأوراق الذهبية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateGoldMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الورقة الذهبية");
      const dto = await validator(UpdateGoldMaterialSchema, req.body);
      const service = new GoldService(req.tenant!);
      const updated = await service.updateGoldMaterial(id, dto as UpdateGoldMaterialDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث الأوراق الذهبية بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getGoldMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId } = req.query;
      const service = new GoldService(req.tenant!);
      const materials = await service.fetchGoldMaterials(subjectId as string);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(materials, "قائمة الأوراق الذهبية"));
    } catch (error) {
      next(error);
    }
  }
}
