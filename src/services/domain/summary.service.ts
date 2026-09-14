import { TenantService } from "../tenant.service";
import { SummaryMaterial, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSummaryMaterialDto, UpdateSummaryMaterialDto } from "../../dto/summary.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";
import { StoredFileService } from "./stored-file.service";
import { FileStorageService } from "../storage/file-storage.service";

export class SummaryService extends TenantService<SummaryMaterial> {
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;
  private _storedFileService?: StoredFileService;

  constructor(tenantContext: TenantContext) {
    super("summaryMaterial", "summaryMaterial", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(this.tenantContext);
    }
    return this._subscriptionService;
  }

  protected get storedFileService(): StoredFileService {
    if (!this._storedFileService) {
      this._storedFileService = new StoredFileService(this.tenantContext);
    }
    return this._storedFileService;
  }

  async createSummaryMaterial(dto: CreateSummaryMaterialDto, file?: Express.Multer.File) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لإضافة الملخصات");
    }

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة في هذه المكتبة");

    if (!file) {
      throw new BadRequestError("يجب إرفاق ملف الملخص بصيغة PDF");
    }

    const subjectFolder = FileStorageService.getSubjectFolder(subject!.name, subject!.id);
    const saved = await FileStorageService.savePdfFile(subjectFolder, file.buffer);

    const storedFile = await this.storedFileService.createFileRecord({
      subjectId: dto.subjectId,
      featureType: FeatureType.SUMMARIES,
      originalName: file.originalname,
      mimeType: file.mimetype || "application/pdf",
      size: saved.size,
      storageKey: saved.storageKey,
      timePeriodId: this.timePeriodId,
    });

    const fileId = storedFile.id;

    return await this.create({
      subjectId: dto.subjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      fileId,
    });
  }

  async updateSummaryMaterial(id: string, dto: UpdateSummaryMaterialDto, file?: Express.Multer.File) {
    const existing = await this.getById(id, {
      include: { file: true, subject: true },
    }) as any;
    Ensure.exists(existing, "summaryMaterial", "الملخص غير موجود");

    let newFileId = existing.fileId;
    let oldFileToDelete: { id: string; storageKey: string } | null = null;

    if (file) {
      const subjectFolder = FileStorageService.getSubjectFolder(
        existing.subject.name,
        existing.subject.id
      );
      const saved = await FileStorageService.savePdfFile(subjectFolder, file.buffer);

      const newStoredFile = await this.storedFileService.createFileRecord({
        subjectId: existing.subjectId,
        featureType: FeatureType.SUMMARIES,
        originalName: file.originalname,
        mimeType: file.mimetype || "application/pdf",
        size: saved.size,
        storageKey: saved.storageKey,
        timePeriodId: this.timePeriodId,
      });

      newFileId = newStoredFile.id;
      if (existing.file) {
        oldFileToDelete = {
          id: existing.file.id,
          storageKey: existing.file.storageKey,
        };
      }
    }

    const updated = await this.update(id, {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      fileId: newFileId,
    });

    if (oldFileToDelete) {
      await FileStorageService.deletePhysicalFile(oldFileToDelete.storageKey);
      await this.storedFileService.deleteFileRecord(oldFileToDelete.id);
    }

    return updated;
  }

  async deleteSummaryMaterial(id: string) {
    const existing = await this.getById(id, {
      include: { file: true },
    }) as any;
    Ensure.exists(existing, "summaryMaterial", "الملخص غير موجود");

    await this.delete(id);

    if (existing.file) {
      await FileStorageService.deletePhysicalFile(existing.file.storageKey);
      await this.storedFileService.deleteFileRecord(existing.file.id);
    }

    return { success: true };
  }

  async fetchSummaryMaterials(subjectId?: string) {
    const where: any = {};

    // For students: enforce active subscription per specific file / material!
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedMaterialIds = await this.subscriptionService.getStudentActiveSubscribedMaterialIds(
        this.tenantContext.userId,
        FeatureType.SUMMARIES,
        subjectId
      );

      // If student has no active subscriptions for summaries, return empty immediately
      if (subscribedMaterialIds.length === 0) {
        return [];
      }

      where.id = { in: subscribedMaterialIds };
    } else if (subjectId) {
      where.subjectId = subjectId;
    }

    return await this.getAll({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        file: {
          select: {
            id: true,
            originalName: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
