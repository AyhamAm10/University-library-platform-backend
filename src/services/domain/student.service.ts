import { TenantService } from "../tenant.service";
import { Student } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { TenantContext } from "../../types/tenant.context";
import { CreateStudentDto, UpdateStudentDto } from "../../dto/student.dto";
import bcrypt from "bcryptjs";
import { BranchService } from "./branch.service";
import { DepartmentService } from "./department.service";
import { prisma } from "../../config/prisma";

export class StudentService extends TenantService<Student> {
  private _branchService?: BranchService;
  private _departmentService?: DepartmentService;

  constructor(tenantContext: TenantContext) {
    super("student", "student", tenantContext, false);
  }

  protected get branchService(): BranchService {
    if (!this._branchService) {
      this._branchService = new BranchService(this.tenantContext);
    }
    return this._branchService;
  }

  protected get departmentService(): DepartmentService {
    if (!this._departmentService) {
      this._departmentService = new DepartmentService(this.tenantContext);
    }
    return this._departmentService;
  }

  async generateUniqueStudentCode(): Promise<string> {
    let attempts = 0;
    while (attempts < 15) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.model.findUnique({
        where: { studentCode: code },
      });
      if (!existing) {
        return code;
      }
      attempts++;
    }
    return Date.now().toString().slice(-6);
  }

  async createStudent(dto: CreateStudentDto) {
    let branchId: string | null = null;
    let departmentId: string | null = null;

    if (dto.branchId) {
      const branch = await this.branchService.findById(dto.branchId);
      Ensure.exists(branch, "branch", "الفرع المحدد غير موجود في هذه المكتبة");
      branchId = dto.branchId;

      if (branch!.hasDepartments && dto.departmentId) {
        const department = await this.departmentService.findById(dto.departmentId);
        Ensure.exists(department, "department", "القسم المحدد غير موجود تحت هذا الفرع");
        if (department!.branchId !== dto.branchId) {
          throw new BadRequestError("القسم المحدد غير موجود تحت هذا الفرع");
        }
        departmentId = dto.departmentId;
      }
    }

    // 2. Check phone uniqueness using TenantService
    const existingPhone = await this.findOne({ phone: dto.phone.trim() });
    Ensure.alreadyExists(!!existingPhone, "رقم هاتف الطالب");

    // 3. Generate unique 6-digit studentCode
    const studentCode = await this.generateUniqueStudentCode();

    // 4. Generate password if not provided or use provided
    const plainPassword = dto.password?.trim() || Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const student = await this.create({
      studentCode,
      fullName: dto.fullName.trim(),
      dateOfBirth: new Date(dto.dateOfBirth),
      phone: dto.phone.trim(),
      branchId,
      departmentId,
      passwordHash,
      isActive: true, // Created by admin: immediately active without activation code
    });

    return {
      ...student,
      password: plainPassword,
    };
  }

  async updateStudent(id: string, dto: UpdateStudentDto) {
    const student = await this.getById(id);
    Ensure.exists(student, "student");

    let branchId = student!.branchId;
    let departmentId = student!.departmentId;

    if (dto.branchId) {
      const branch = await this.branchService.findById(dto.branchId);
      Ensure.exists(branch, "branch");
      branchId = dto.branchId;

      if (branch!.hasDepartments) {
        const targetDeptId = dto.departmentId ?? departmentId;
        if (!targetDeptId) {
          throw new BadRequestError("الفرع المحدد يتطلب اختيار قسم");
        }
        const dept = await this.departmentService.findById(targetDeptId);
        Ensure.exists(dept, "department");
        if (dept!.branchId !== branchId) {
          throw new BadRequestError("القسم المحدد غير موجود تحت هذا الفرع");
        }
        departmentId = targetDeptId;
      } else {
        departmentId = null;
      }
    }

    if (dto.phone && dto.phone.trim() !== student!.phone) {
      const existingPhone = await this.findOne({ phone: dto.phone.trim() });
      Ensure.alreadyExists(!!existingPhone, "رقم هاتف الطالب");
    }

    const dataToUpdate: any = {
      fullName: dto.fullName?.trim(),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      phone: dto.phone?.trim(),
      branchId,
      departmentId,
      isActive: dto.isActive,
    };

    if (dto.isActive === true) {
      dataToUpdate.activationCode = null;
      dataToUpdate.activationExpiresAt = null;
    }

    return await this.update(id, dataToUpdate);
  }

  async fetchStudents(options?: {
    search?: string;
    branchId?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (options?.search) {
      const query = options.search.trim();
      where.OR = [
        { fullName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { studentCode: { contains: query, mode: "insensitive" } },
      ];
    }

    if (options?.branchId) {
      where.branchId = options.branchId;
    }

    if (options?.departmentId) {
      where.departmentId = options.departmentId;
    }

    return await this.getAllWithPagination({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        _count: {
          select: { subscriptions: true },
        },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async fetchStudentDetails(id: string) {
    const student = await this.getById(id, {
      include: {
        branch: true,
        department: true,
        subscriptions: {
          include: {
            subject: true,
            timePeriod: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    Ensure.exists(student, "student");

    const materialIds = ((student as any).subscriptions || [])
      .map((s: any) => s.materialId)
      .filter((mid: any): mid is string => Boolean(mid));

    let materialMap: Record<string, { id: string; title: string }> = {};

    if (materialIds.length > 0) {
      const [golds, summaries, courses, questions] = await Promise.all([
        (prisma as any).goldMaterial.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true },
        }),
        (prisma as any).summaryMaterial.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true },
        }),
        (prisma as any).course.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true },
        }),
        (prisma as any).questionBankItem.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true, questionText: true },
        }),
      ]);

      golds.forEach((g: any) => { materialMap[g.id] = { id: g.id, title: g.title }; });
      summaries.forEach((s: any) => { materialMap[s.id] = { id: s.id, title: s.title }; });
      courses.forEach((c: any) => { materialMap[c.id] = { id: c.id, title: c.title }; });
      questions.forEach((q: any) => { materialMap[q.id] = { id: q.id, title: q.title || q.questionText }; });
    }

    const allSubscriptions = ((student as any).subscriptions || []).map((sub: any) => ({
      ...sub,
      material: sub.materialId ? materialMap[sub.materialId] || null : null,
    }));

    const activeSubscriptions = allSubscriptions.filter((s: any) => s.status === "ACTIVE");
    const expiredSubscriptions = allSubscriptions.filter((s: any) => s.status === "EXPIRED" || s.status === "CANCELLED");

    return {
      ...student,
      subscriptions: allSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
    };
  }

  async generateActivationCode(id: string) {
    const student = await this.getById(id);
    Ensure.exists(student, "student");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.update(id, {
      activationCode: code,
      activationExpiresAt: expiresAt,
    });

    return {
      studentId: id,
      activationCode: code,
      expiresAt,
    };
  }

  async unbindDevice(id: string) {
    const student = await this.getById(id);
    Ensure.exists(student, "student");

    await this.update(id, {
      boundDeviceId: null,
    });

    return {
      studentId: id,
      message: "تم فك ارتباط الجهاز بهذا الحساب بنجاح",
    };
  }
}
