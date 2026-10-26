import { TenantService } from "../tenant.service";
import { AcademicYear } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateAcademicYearDto, UpdateAcademicYearDto } from "../../dto/academic-year.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { DepartmentService } from "./department.service";
import { BranchService } from "./branch.service";
import { prisma } from "../../config/prisma";

export class AcademicYearService extends TenantService<AcademicYear> {
  private _departmentService?: DepartmentService;
  private _branchService?: BranchService;

  constructor(tenantContext: TenantContext) {
    // AcademicYear is tenant-scoped but not period-scoped (timePeriodId: false)
    super("academicYear", "academicYear", tenantContext, false);
  }

  protected get departmentService(): DepartmentService {
    if (!this._departmentService) {
      this._departmentService = new DepartmentService(this.tenantContext);
    }
    return this._departmentService;
  }

  protected get branchService(): BranchService {
    if (!this._branchService) {
      this._branchService = new BranchService(this.tenantContext);
    }
    return this._branchService;
  }

  async createAcademicYear(params: {
    branchId: string;
    departmentId?: string | null;
    name: string;
    yearOrder?: number;
  }) {
    // 1. Verify branch exists
    const branch = await this.branchService.findById(params.branchId);
    Ensure.exists(branch, "branch", "الفرع الأكاديمي غير موجود في هذه المكتبة");

    // 2. If departmentId is provided, verify it exists and belongs to this branch
    let deptId: string | null = null;
    if (params.departmentId) {
      const department = await this.departmentService.findById(params.departmentId);
      Ensure.exists(department, "department", "القسم الأكاديمي غير موجود في هذه المكتبة");
      if (department.branchId !== params.branchId) {
        throw new BadRequestError("القسم المحدد لا ينتمي إلى هذا الفرع");
      }
      deptId = department.id;
    }

    // 3. Check duplicate name under the same branch and department
    const existing = await this.findOne({
      branchId: params.branchId,
      departmentId: deptId,
      name: params.name.trim(),
    });

    if (existing) {
      throw new BadRequestError(`السنة الدراسية "${params.name.trim()}" مضافة مسبقاً`);
    }

    return await this.create({
      branchId: params.branchId,
      departmentId: deptId,
      name: params.name.trim(),
      yearOrder: params.yearOrder ?? 1,
      isActive: true,
    });
  }

  async createAcademicYearForDepartment(departmentId: string, dto: CreateAcademicYearDto) {
    const department = await this.departmentService.findById(departmentId);
    Ensure.exists(department, "department", "القسم الأكاديمي غير موجود في هذه المكتبة");

    return await this.createAcademicYear({
      branchId: department.branchId,
      departmentId: department.id,
      name: dto.name,
      yearOrder: dto.yearOrder,
    });
  }

  async createAcademicYearForBranch(branchId: string, dto: CreateAcademicYearDto) {
    return await this.createAcademicYear({
      branchId,
      departmentId: dto.departmentId || null,
      name: dto.name,
      yearOrder: dto.yearOrder,
    });
  }

  async updateAcademicYear(id: string, dto: UpdateAcademicYearDto) {
    const existing = await this.findById(id);
    Ensure.exists(existing, "academicYear", "السنة الدراسية غير موجودة");

    return await this.update(id, {
      name: dto.name?.trim(),
      yearOrder: dto.yearOrder,
      isActive: dto.isActive,
    });
  }

  async deleteAcademicYear(id: string) {
    const existing = await this.findById(id);
    Ensure.exists(existing, "academicYear", "السنة الدراسية غير موجودة");

    // Check if any subjects belong to this academic year
    const subjectsCount = await prisma.subject.count({
      where: {
        libraryId: this.libraryId,
        academicYearId: id,
      },
    });

    if (subjectsCount > 0) {
      throw new BadRequestError(
        `لا يمكن حذف السنة الدراسية لأنها مرتبطة بـ ${subjectsCount} مادة دراسية. يرجى نقل المواد أو حذفها أولاً.`
      );
    }

    await this.delete(id);
  }

  async fetchAcademicYears(filter: { branchId?: string; departmentId?: string }) {
    const where: any = { isActive: true };

    if (filter.branchId) {
      where.branchId = filter.branchId;
    }

    if (filter.departmentId !== undefined) {
      where.departmentId = filter.departmentId;
    }

    return await this.getAll({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: {
          select: { subjects: true, students: true },
        },
      },
      orderBy: { yearOrder: "asc" },
    });
  }

  async fetchAcademicYearsByDepartment(departmentId: string) {
    return await this.fetchAcademicYears({ departmentId });
  }

  async fetchAcademicYearsByBranch(branchId: string, departmentId?: string) {
    return await this.fetchAcademicYears({ branchId, departmentId });
  }
}
