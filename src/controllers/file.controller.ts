import { Request, Response, NextFunction } from "express";
import { StoredFileService } from "../services/domain/stored-file.service";
import { SubscriptionService } from "../services/domain/subscription.service";
import { FileStorageService } from "../services/storage/file-storage.service";
import { Ensure } from "../common/errors/Ensure.handler";
import { ForbiddenError, NotFoundError } from "../common/errors/http.error";
import { FeatureType } from "@prisma/client";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";

export class FileController {
  /**
   * Securely stream PDF file with HTTP Range support and comprehensive authorization.
   */
  async streamPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      Ensure.exists(fileId, "معرف الملف");

      const storedFileService = new StoredFileService(req.tenant!);
      const file = await storedFileService.getFileById(fileId);

      if (!file) {
        throw new NotFoundError("الملف المطلوب غير موجود أو غير متاح في هذه المكتبة");
      }

      // If requested by a student, perform authoritative security and subscription checks
      if (req.tenant!.role === "STUDENT") {
        const student = (req as any).student;
        if (!student || !student.isActive) {
          throw new ForbiddenError("حساب الطالب غير مفعل أو غير مصرح له");
        }

        // Device binding validation
        const incomingDeviceId = (req.headers["x-device-id"] as string);
        if (student.boundDeviceId && incomingDeviceId && student.boundDeviceId !== incomingDeviceId) {
          throw new ForbiddenError("غير مصرح بالوصول لهذا الملف من جهاز غير مقترن بحسابك");
        }

        // Active subscription validation based on feature type
        const subscriptionService = new SubscriptionService(req.tenant!);
        let isAuthorized = false;

        if (file.featureType === FeatureType.LECTURES) {
          // Lecture subscription is subject-wide
          isAuthorized = await subscriptionService.checkStudentFeatureAccess(
            student.id,
            file.subjectId,
            FeatureType.LECTURES
          );
        } else if (file.featureType === FeatureType.SUMMARIES) {
          // Summary subscription can be subject-wide or per-material
          isAuthorized = await subscriptionService.checkStudentFeatureAccess(
            student.id,
            file.subjectId,
            FeatureType.SUMMARIES
          );

          if (!isAuthorized) {
            const summaryIds = (file as any).summaries?.map((s: any) => s.id) || [];
            for (const sId of summaryIds) {
              if (
                await subscriptionService.checkStudentFeatureAccess(
                  student.id,
                  file.subjectId,
                  FeatureType.SUMMARIES,
                  sId
                )
              ) {
                isAuthorized = true;
                break;
              }
            }
          }
        } else if (file.featureType === FeatureType.QUESTION_BANK) {
          // Course questions subscription can be subject-wide or per-item
          isAuthorized = await subscriptionService.checkStudentFeatureAccess(
            student.id,
            file.subjectId,
            FeatureType.QUESTION_BANK
          );

          if (!isAuthorized) {
            const questionIds = (file as any).questions?.map((q: any) => q.id) || [];
            for (const qId of questionIds) {
              if (
                await subscriptionService.checkStudentFeatureAccess(
                  student.id,
                  file.subjectId,
                  FeatureType.QUESTION_BANK,
                  qId
                )
              ) {
                isAuthorized = true;
                break;
              }
            }
          }
        }

        if (!isAuthorized) {
          throw new ForbiddenError("لا تملك اشتراكاً فعالاً للوصول إلى هذا المحتوى التعليمي");
        }
      }

      // Stream file without exposing physical filesystem path or storage key
      FileStorageService.streamFile(res, file.storageKey, req.headers.range, file.originalName);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get safe metadata for a file (excludes storageKey and physical path).
   */
  async getFileMetadata(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      Ensure.exists(fileId, "معرف الملف");

      const storedFileService = new StoredFileService(req.tenant!);
      const file = await storedFileService.getFileById(fileId);

      if (!file) {
        throw new NotFoundError("الملف المطلوب غير موجود");
      }

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(
          {
            id: file.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            featureType: file.featureType,
            createdAt: file.createdAt,
          },
          "بيانات الملف"
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
