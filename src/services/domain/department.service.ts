import { TenantService } from "../tenant.service";
import { Department } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { TenantContext } from "../../types/tenant.context";
import { CreateDepartmentDto, UpdateDepartmentDto } from "../../dto/department.dto";
import { BranchService } from "./branch.service";
import { StudentService } from "./student.service";

export class DepartmentService extends TenantService<Department> {
  private _branchService?: BranchService;
  private _studentService?: StudentService;

  constructor(tenantContext: TenantContext) {
    super("department", "department", tenantContext, false);
  }

  protected get branchService(): BranchService {
    if (!this._branchService) {
      this._branchService = new BranchService(this.tenantContext);
    }
    return this._branchService;
  }

  protected get studentService(): StudentService {
    if (!this._studentService) {
      this._studentService = new StudentService(this.tenantContext);
    }
    return this._studentService;
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const branch = await this.branchService.findById(dto.branchId);

    Ensure.exists(branch, "branch", "الفرع المحدد غير موجود في هذه المكتبة");

    if (!branch!.hasDepartments) {
      throw new BadRequestError("هذا الفرع مُهيأ لعدم استخدام الأقسام، يرجى تفعيل الأقسام في إعدادات الفرع أولاً");
    }

    return await this.create({
      branchId: dto.branchId,
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      isActive: true,
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    return await this.update(id, {
      ...dto,
      name: dto.name?.trim(),
      code: dto.code?.trim(),
    });
  }

  async deleteDepartment(id: string) {
    const studentCount = await this.studentService.count({ departmentId: id });

    if (studentCount > 0) {
      throw new BadRequestError(`لا يمكن حذف القسم لاحتوائه على ${studentCount} من الطلاب المسجلين`);
    }

    await this.delete(id);
  }

  async fetchDepartmentsByBranch(branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }

    return await this.getAll({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
