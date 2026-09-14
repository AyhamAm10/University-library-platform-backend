import { TenantService } from "../tenant.service";
import { Subject } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSubjectDto, UpdateSubjectDto } from "../../dto/subject.dto";

export class SubjectService extends TenantService<Subject> {
  constructor(tenantContext: TenantContext) {
    super("subject", "subject", tenantContext, false);
  }

  async createSubject(dto: CreateSubjectDto) {
    return await this.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      description: dto.description?.trim() || null,
      isActive: true,
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    return await this.update(id, {
      ...dto,
      name: dto.name?.trim(),
      code: dto.code?.trim(),
      description: dto.description?.trim(),
    });
  }

  async fetchSubjects(options?: { search?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { code: { contains: options.search, mode: "insensitive" } },
      ];
    }

    return await this.getAllWithPagination({
      where,
      include: {
        _count: {
          select: {
            lectures: true,
            goldMaterials: true,
            summaries: true,
            courses: true,
            questions: true,
            subscriptions: true,
          },
        },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async fetchSubjectDetails(id: string) {
    const subject = await this.getById(id, {
      include: {
        _count: {
          select: {
            lectures: true,
            goldMaterials: true,
            summaries: true,
            courses: true,
            questions: true,
            subscriptions: true,
          },
        },
      },
    });

    return subject;
  }
}
