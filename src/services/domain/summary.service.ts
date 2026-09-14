import { TenantService } from "../tenant.service";
import { SummaryMaterial } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSummaryMaterialDto, UpdateSummaryMaterialDto } from "../../dto/summary.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";

export class SummaryService extends TenantService<SummaryMaterial> {
  private _subjectService?: SubjectService;

  constructor(tenantContext: TenantContext) {
    super("summaryMaterial", "summaryMaterial", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  async createSummaryMaterial(dto: CreateSummaryMaterialDto) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لإضافة الملخصات");
    }

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject");

    return await this.create({
      subjectId: dto.subjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      fileUrl: dto.fileUrl?.trim() || null,
    });
  }

  async updateSummaryMaterial(id: string, dto: UpdateSummaryMaterialDto) {
    return await this.update(id, {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      fileUrl: dto.fileUrl?.trim(),
    });
  }

  async fetchSummaryMaterials(subjectId?: string) {
    const where: any = {};
    if (subjectId) {
      where.subjectId = subjectId;
    }

    return await this.getAll({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
