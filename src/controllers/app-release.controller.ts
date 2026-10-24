import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { AppReleaseService } from "../services/domain/app-release.service";
import { validator } from "../common/errors/validator";
import { CreateAppReleaseSchema, CreateAppReleaseDto, CheckAppVersionSchema } from "../dto/app-release.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";

export class AppReleaseController {
  /**
   * Publish a new release (Super Admin only)
   * POST /api/app-releases
   */
  async publishRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateAppReleaseSchema, req.body);
      const service = new AppReleaseService();
      const release = await service.publishRelease(dto as CreateAppReleaseDto, req.file);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(release, "تم نشر الإصدار الجديد لتطبيق الموبايل بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check app version and get update status (Public / Mobile App)
   * GET /api/app-releases/check
   */
  async checkVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const query = await validator(CheckAppVersionSchema, req.query);
      const service = new AppReleaseService();
      const result = await service.checkVersion(query.version, query.versionCode);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download the active APK file (Public / Mobile App)
   * GET /api/app-releases/download
   */
  async downloadRelease(_req: Request, res: Response, next: NextFunction) {
    try {
      const service = new AppReleaseService();
      const info = await service.getDownloadStream();

      res.setHeader("Content-Type", info.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(info.originalDownloadName)}"`
      );
      res.setHeader("Content-Length", info.fileSize.toString());

      const stream = fs.createReadStream(info.physicalPath);
      stream.on("error", (err) => next(err));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active release details
   * GET /api/app-releases/active
   */
  async getActiveRelease(_req: Request, res: Response, next: NextFunction) {
    try {
      const service = new AppReleaseService();
      const active = await service.getActiveRelease();

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(active));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all releases history (Super Admin only)
   * GET /api/app-releases
   */
  async getReleasesHistory(_req: Request, res: Response, next: NextFunction) {
    try {
      const service = new AppReleaseService();
      const list = await service.getReleasesHistory();

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(list));
    } catch (error) {
      next(error);
    }
  }
}
