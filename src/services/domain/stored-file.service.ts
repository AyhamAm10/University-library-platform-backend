import { TenantService } from "../tenant.service";
import { StoredFile, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";

export class StoredFileService extends TenantService<StoredFile> {
  constructor(tenantContext: TenantContext) {
    super("storedFile", "storedFile", tenantContext, false);
  }

  async createFileRecord(data: {
    subjectId: string;
    featureType: FeatureType;
    originalName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    timePeriodId?: string;
  }): Promise<StoredFile> {
    return await this.create({
      subjectId: data.subjectId,
      featureType: data.featureType,
      originalName: data.originalName,
      mimeType: data.mimeType || "application/pdf",
      size: data.size,
      storageKey: data.storageKey,
      timePeriodId: data.timePeriodId || this.tenantContext.timePeriodId || null,
    });
  }

  async getFileById(id: string): Promise<StoredFile | null> {
    return await this.getById(id, {
      include: {
        subject: { select: { id: true, name: true } },
        lectures: { select: { id: true } },
        summaries: { select: { id: true } },
        questions: { select: { id: true } },
      },
    });
  }

  async deleteFileRecord(id: string): Promise<void> {
    await this.delete(id);
  }
}
