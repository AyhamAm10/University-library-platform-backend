import { Request, Response, NextFunction } from "express";
import { LibraryService } from "../services/domain/library.service";
import { validator } from "../common/errors/validator";
import { CreateLibrarySchema, CreateLibraryDto, UpdateLibrarySchema, UpdateLibraryDto } from "../dto/library.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class LibraryController {
  async createLibrary(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateLibrarySchema, req.body);
      const service = new LibraryService();
      const result = await service.createLibraryWithAdmin(dto as CreateLibraryDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(result, "تم إنشاء المكتبة وتعيين المدير بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getAllLibraries(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new LibraryService();
      const { search, isActive, page, limit } = req.query;

      const result = await service.fetchAllLibraries({
        search: search as string,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "تم جلب قائمة المكتبات بنجاح", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getLibraryDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المكتبة");
      const service = new LibraryService();
      const library = await service.fetchLibraryDetails(id);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(library, "تفاصيل المكتبة"));
    } catch (error) {
      next(error);
    }
  }

  async updateLibrary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المكتبة");
      const dto = await validator(UpdateLibrarySchema, req.body);
      const service = new LibraryService();
      const updated = await service.update(id, dto as UpdateLibraryDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث بيانات المكتبة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف المكتبة");
      const service = new LibraryService();
      const updated = await service.toggleLibraryStatus(id);

      return res
        .status(HttpStatusCode.OK)
        .json(ApiResponse.success(updated, `تم ${updated.isActive ? "تفعيل" : "تعطيل"} المكتبة بنجاح`));
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStats(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new LibraryService();
      const stats = await service.getPlatformStats();
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(stats, "إحصائيات المنصة العامة"));
    } catch (error) {
      next(error);
    }
  }
}
