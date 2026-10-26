import { TenantService } from "../tenant.service";
import { Subject } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSubjectDto, UpdateSubjectDto } from "../../dto/subject.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { prisma } from "../../config/prisma";

export class SubjectService extends TenantService<Subject> {
  constructor(tenantContext: TenantContext) {
    super("subject", "subject", tenantContext, false);
  }

  async createSubject(dto: CreateSubjectDto) {
    let branchId = dto.branchId || null;
    let departmentId = dto.departmentId || null;

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, libraryId: this.libraryId },
        select: { id: true, branchId: true },
      });
      Ensure.exists(department, "department", "القسم المحدد غير موجود في هذه المكتبة");
      if (!branchId && department.branchId) {
        branchId = department.branchId;
      }
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, libraryId: this.libraryId },
      });
      Ensure.exists(branch, "branch", "الفرع المحدد غير موجود في هذه المكتبة");
      if (branch.hasDepartments && !departmentId) {
        throw new BadRequestError("هذا الفرع يتفرع إلى أقسام، يرجى تحديد القسم التابع له المادة");
      }
    }

    // التحقق من أن السنة الدراسية تتبع لهذا الفرع / القسم والمكتبة
    if (dto.academicYearId) {
      const academicYear = await prisma.academicYear.findFirst({
        where: {
          id: dto.academicYearId,
          libraryId: this.libraryId,
          ...(branchId && { branchId }),
          ...(departmentId && { departmentId }),
        },
      });
      Ensure.exists(academicYear, "academicYear", "السنة الدراسية المحددة غير صالحة أو لا تتبع لهذا الفرع/القسم");
    }

    return await this.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      description: dto.description?.trim() || null,
      departmentId,
      branchId,
      academicYearId: dto.academicYearId || null,
      yearLevel: dto.yearLevel || 1,
      isActive: true,
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    if (dto.academicYearId) {
      const existing = await this.findById(id);
      Ensure.exists(existing, "subject");
      const deptId = existing!.departmentId || undefined;
      const academicYear = await prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, libraryId: this.libraryId, ...(deptId && { departmentId: deptId }) },
      });
      Ensure.exists(academicYear, "academicYear", "السنة الدراسية غير صالحة");
    }

    return await this.update(id, {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.code !== undefined && { code: dto.code?.trim() || null }),
      ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId || null }),
      ...(dto.yearLevel !== undefined && { yearLevel: dto.yearLevel }),
      ...(dto.branchId !== undefined && { branchId: dto.branchId || null }),
    });
  }

  async fetchSubjects(options?: {
    search?: string;
    page?: number;
    limit?: number;
    departmentId?: string;
    branchId?: string;
    academicYearId?: string;
    yearLevel?: number;
  }) {
    const where: any = { isActive: true };

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { code: { contains: options.search, mode: "insensitive" } },
      ];
    }

    if (options?.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options?.branchId !== undefined) {
      where.branchId = options.branchId || null;
    }

    if (options?.academicYearId) {
      where.academicYearId = options.academicYearId;
    }

    if (options?.yearLevel !== undefined) {
      where.yearLevel = options.yearLevel;
    }

    return await this.getAllWithPagination({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, yearOrder: true } },
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
      orderBy: [{ academicYear: { yearOrder: "asc" } }, { name: "asc" }],
    });
  }

  async fetchSubjectDetails(id: string) {
    return await this.getById(id, {
      include: {
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, yearOrder: true } },
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
  }

  /**
   * يجلب مواد دراسية بناءً على قسم وسنة دراسية محددين
   * يُستخدم من grouped-content.service وأي خدمة تحتاج لفلترة أكاديمية
   */
  async fetchSubjectsByAcademicContext(options: {
    departmentId: string;
    branchId?: string | null;
    yearLevel?: number;
  }): Promise<Subject[]> {
    const where: any = {
      libraryId: this.libraryId,
      departmentId: options.departmentId,
      isActive: true,
    };

    if (options.yearLevel !== undefined) {
      where.yearLevel = options.yearLevel;
    }

    if (options.branchId !== undefined) {
      // مواد الفرع المحدد + المواد العامة للقسم (branchId = null)
      where.OR = [
        { branchId: options.branchId },
        { branchId: null },
      ];
    }

    return await this.getAll({ where, orderBy: [{ yearLevel: "asc" }, { name: "asc" }] });
  }
}
