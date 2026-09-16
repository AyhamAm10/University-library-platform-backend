import { Request, Response, NextFunction } from "express";
import { GroupedContentService } from "../services/domain/grouped-content.service";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";
import { FeatureType } from "@prisma/client";
import { BadRequestError } from "../common/errors/http.error";

export class GroupedContentController {
  async getGroupedContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { featureType } = req.query;
      Ensure.exists(featureType, "نوع الخدمة التعليمية (featureType)");

      const validTypes = Object.values(FeatureType);
      if (!validTypes.includes(featureType as FeatureType)) {
        throw new BadRequestError(`نوع الخدمة التعليمية غير صالح. القيم المسموحة: ${validTypes.join(", ")}`);
      }

      const service = new GroupedContentService(req.tenant!);
      const data = await service.getGroupedContent(featureType as FeatureType);

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(data, "المحتوى المجمع للمواد والاشتراكات")
      );
    } catch (error) {
      next(error);
    }
  }
}
