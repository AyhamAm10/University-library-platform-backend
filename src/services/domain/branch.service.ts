import { TenantService } from "../tenant.service";
import { Branch } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { TenantContext } from "../../types/tenant.context";
import { CreateBranchDto, UpdateBranchDto } from "../../dto/branch.dto";
import { StudentService } from "./student.service";

export class BranchService extends TenantService<Branch> {
  private _studentService?: StudentService;

  constructor(tenantContext: TenantContext) {
    super("branch", "branch", tenantContext, false);
  }

  protected get studentService(): StudentService {
    if (!this._studentService) {
      this._studentService = new StudentService(this.tenantContext);
    }
    return this._studentService;
  }

  async createBranch(dto: CreateBranchDto) {
    const branch = await this.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
      hasDepartments: dto.hasDepartments ?? false,
      isActive: true,
    });

    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    return await this.update(id, {
      ...dto,
      name: dto.name?.trim(),
      code: dto.code?.trim(),
    });
  }

  async deleteBranch(id: string) {
    const studentCount = await this.studentService.count({ branchId: id });

    if (studentCount > 0) {
      throw new BadRequestError(`لا يمكن حذف الفرع لاحتوائه على ${studentCount} من الطلاب المسجلين`);
    }

    await this.delete(id);
  }

  async fetchBranches() {
    return await this.getAll({
      include: {
        departments: {
          where: { isActive: true },
        },
        _count: {
          select: {
            students: true,
            departments: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
