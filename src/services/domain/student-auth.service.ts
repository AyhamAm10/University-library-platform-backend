import { RepoService } from "../repo.service";
import { Student } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { UnauthorizedError, ForbiddenError, BadRequestError } from "../../common/errors/http.error";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Environment } from "../../config/environment";
import {
  StudentRegisterDto,
  StudentLoginDto,
  StudentActivateDto,
  StudentRefreshDto,
} from "../../dto/student-auth.dto";
import { BranchService } from "./branch.service";
import { DepartmentService } from "./department.service";
import { TimePeriodService } from "./time-period.service";
import { LibraryService } from "./library.service";

export interface StudentJwtPayload {
  studentId: string;
  libraryId: string;
  role: "STUDENT";
  deviceId: string;
}

export class StudentAuthService extends RepoService<Student> {
  constructor() {
    super("student", "student");
  }

  /**
   * Fetch active libraries with their branches and departments for registration.
   */
  async getAcademicStructure() {
    const libraryService = new LibraryService();
    const libraries = await libraryService.findMany(
      { isActive: true },
      {
        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          branches: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
              hasDepartments: true,
              departments: {
                where: { isActive: true },
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      }
    );

    return libraries;
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

  /**
   * Register a new student through the mobile application.
   * Student is initially created with isActive = false, unique 6-digit studentCode, and a 6-digit activation code.
   */
  async register(dto: StudentRegisterDto) {
    // 1. Verify branch if provided
    let branchId: string | null = null;
    let departmentId: string | null = null;

    if (dto.branchId) {
      const branchService = new BranchService({ libraryId: dto.libraryId });
      const branch = await branchService.findById(dto.branchId);
      Ensure.exists(branch, "branch", "الفرع المحدد غير موجود في هذه المكتبة");
      branchId = dto.branchId;

      if (branch!.hasDepartments && dto.departmentId) {
        const departmentService = new DepartmentService({ libraryId: dto.libraryId });
        const department = await departmentService.findById(dto.departmentId);
        Ensure.exists(department, "department", "القسم المحدد غير موجود تحت هذا الفرع");
        if (department!.branchId !== dto.branchId) {
          throw new BadRequestError("القسم المحدد غير موجود تحت هذا الفرع");
        }
        departmentId = dto.departmentId;
      }
    }

    // 2. Ensure phone uniqueness
    const existingPhone = await this.findOne({
      phone: dto.phone.trim(),
    });
    Ensure.alreadyExists(!!existingPhone, "رقم هاتف الطالب");

    // 3. Generate unique 6-digit studentCode
    const studentCode = await this.generateUniqueStudentCode();

    // 4. Generate 6-digit numeric activation code with 15-minute expiration
    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const activationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const student = await this.create({
      studentCode,
      libraryId: dto.libraryId,
      branchId,
      departmentId,
      fullName: dto.fullName.trim(),
      dateOfBirth: new Date(dto.dateOfBirth),
      phone: dto.phone.trim(),
      passwordHash,
      isActive: false, // Inactive until device activation
      activationCode,
      activationExpiresAt,
    });

    return {
      student: this.sanitizeStudent(student),
      requiresActivation: true,
      activationCode, // Returned for transparent activation flow
      message: "تم إنشاء الحساب بنجاح، يرجى تفعيل الحساب لربطه بهذا الجهاز",
    };
  }

  /**
   * Activate student account with activation code and bind device.
   */
  async activate(dto: StudentActivateDto) {
    const student = await this.findOne(
      { phone: dto.phone.trim() },
      { include: { library: true, branch: true, department: true } }
    );

    Ensure.exists(student, "student", "رقم الهاتف غير مسجل");

    // Check if student is already bound to a different device
    if (student!.boundDeviceId && student!.boundDeviceId !== dto.deviceId) {
      throw new ForbiddenError("هذا الحساب مستخدم على جهاز آخر بالفعل");
    }

    // Validate activation code
    if (!student!.activationCode) {
      throw new BadRequestError("لا يوجد رمز تفعيل معلق لهذا الحساب، قد يكون الحساب مفعلاً بالفعل");
    }

    if (student!.activationCode !== dto.activationCode.trim()) {
      throw new BadRequestError("رمز التفعيل المدخل غير صحيح");
    }

    if (student!.activationExpiresAt && new Date() > new Date(student!.activationExpiresAt)) {
      throw new BadRequestError("انتهت صلاحية رمز التفعيل، يرجى طلب رمز جديد من الإدارة");
    }

    // Bind device, activate account, and clear activation code
    const updated = await this.update(student!.id, {
      isActive: true,
      boundDeviceId: dto.deviceId,
      activationCode: null,
      activationExpiresAt: null,
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(updated.id, updated.libraryId, dto.deviceId);
    const refreshToken = this.generateRefreshToken(updated.id, dto.deviceId, (updated as any).tokenVersion ?? 0);

    // Resolve active time period
    const periodService = new TimePeriodService({ libraryId: updated.libraryId });
    const activeTimePeriod = await periodService.getCurrentActivePeriod();

    return {
      student: {
        ...this.sanitizeStudent(updated),
        library: (student as any).library,
        branch: (student as any).branch,
        department: (student as any).department,
        activeTimePeriod,
      },
      accessToken,
      refreshToken,
      message: "تم تفعيل الحساب وربط الجهاز بنجاح",
    };
  }

  /**
   * Mobile student login enforcing device binding and active account state.
   */
  async login(dto: StudentLoginDto) {
    const student = await this.findOne(
      { phone: dto.phone.trim() },
      { include: { library: true, branch: true, department: true } }
    );

    Ensure.exists(student, "student", "رقم الهاتف أو كلمة المرور غير صحيحة");

    if (!student!.passwordHash) {
      throw new UnauthorizedError("يرجى تفعيل حسابك أولاً وتعيين كلمة المرور");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, student!.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("رقم الهاتف أو كلمة المرور غير صحيحة");
    }

    // Account activation check
    if (!student!.isActive) {
      throw new ForbiddenError("هذا الحساب غير مفعل");
    }

    // Device binding check: authoritative server-side check
    if (student!.boundDeviceId && student!.boundDeviceId !== dto.deviceId) {
      throw new ForbiddenError("هذا الحساب مستخدم على جهاز آخر بالفعل");
    }

    // If student has no device bound yet, bind to this device
    let currentStudent = student!;
    if (!student!.boundDeviceId) {
      currentStudent = await this.update(student!.id, {
        boundDeviceId: dto.deviceId,
      });
    }

    const accessToken = this.generateAccessToken(currentStudent.id, currentStudent.libraryId, dto.deviceId);
    const refreshToken = this.generateRefreshToken(currentStudent.id, dto.deviceId, (currentStudent as any).tokenVersion ?? 0);

    // Resolve active period for student's library
    const periodService = new TimePeriodService({ libraryId: currentStudent.libraryId });
    const activeTimePeriod = await periodService.getCurrentActivePeriod();

    return {
      student: {
        ...this.sanitizeStudent(currentStudent),
        library: (student as any).library,
        branch: (student as any).branch,
        department: (student as any).department,
        activeTimePeriod,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh student access token using long-lived refresh token and device ID.
   */
  async refresh(dto: StudentRefreshDto) {
    let decoded: any;
    try {
      decoded = jwt.verify(dto.refreshToken, Environment.JWT_REFRESH_SECRET);
    } catch {
      throw new UnauthorizedError("جلسة الدخول منتهية الصلاحية، يرجى تسجيل الدخول من جديد");
    }

    if (!decoded.studentId) {
      throw new UnauthorizedError("رمز التحديث غير صالح");
    }

    const student = await this.getById(decoded.studentId);
    Ensure.exists(student, "student", "المستخدم غير موجود");

    if (!student!.isActive) {
      throw new ForbiddenError("تم تعطيل هذا الحساب، يرجى مراجعة إدارة المنصة");
    }

    // Invalidate if tokenVersion in payload does not match current student tokenVersion in DB
    if (
      decoded.tokenVersion !== undefined &&
      (student as any).tokenVersion !== undefined &&
      decoded.tokenVersion !== (student as any).tokenVersion
    ) {
      throw new UnauthorizedError("جلسة الدخول تم إنهاؤها أو إبطالها، يرجى تسجيل الدخول من جديد");
    }

    if (student!.boundDeviceId && student!.boundDeviceId !== dto.deviceId) {
      throw new ForbiddenError("هذا الحساب مستخدم على جهاز آخر بالفعل");
    }

    const newAccessToken = this.generateAccessToken(student!.id, student!.libraryId, dto.deviceId);
    const newRefreshToken = this.generateRefreshToken(student!.id, dto.deviceId, (student as any).tokenVersion ?? 0);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke current student session by incrementing tokenVersion in DB.
   */
  async logout(studentId: string) {
    await this.model.update({
      where: { id: studentId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { success: true, message: "تم تسجيل الخروج بنجاح" };
  }

  /**
   * Get current authenticated student profile.
   */
  async getMe(studentId: string, deviceId?: string) {
    const student = await this.getById(studentId, {
      include: {
        library: true,
        branch: true,
        department: true,
      },
    });

    Ensure.exists(student, "student");

    if (!student!.isActive) {
      throw new ForbiddenError("هذا الحساب غير مفعل");
    }

    if (deviceId && student!.boundDeviceId && student!.boundDeviceId !== deviceId) {
      throw new ForbiddenError("هذا الحساب مستخدم على جهاز آخر بالفعل");
    }

    const periodService = new TimePeriodService({ libraryId: student!.libraryId });
    const activeTimePeriod = await periodService.getCurrentActivePeriod();

    return {
      ...this.sanitizeStudent(student!),
      library: (student as any).library,
      branch: (student as any).branch,
      department: (student as any).department,
      activeTimePeriod,
    };
  }

  /**
   * Admin method to generate/reissue an activation code for a student.
   */
  async generateActivationCode(studentId: string) {
    const student = await this.getById(studentId);
    Ensure.exists(student, "student");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.update(studentId, {
      activationCode: code,
      activationExpiresAt: expiresAt,
    });

    return {
      studentId,
      activationCode: code,
      expiresAt,
    };
  }

  private generateAccessToken(studentId: string, libraryId: string, deviceId: string): string {
    const payload: StudentJwtPayload = {
      studentId,
      libraryId,
      role: "STUDENT",
      deviceId,
    };

    return jwt.sign(payload, Environment.JWT_ACCESS_SECRET, { expiresIn: "1h" });
  }

  private generateRefreshToken(studentId: string, deviceId: string, tokenVersion: number = 0): string {
    return jwt.sign(
      { studentId, deviceId, role: "STUDENT", tokenVersion },
      Environment.JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );
  }

  private sanitizeStudent(student: any) {
    const { passwordHash, activationCode, ...safe } = student;
    return safe;
  }
}
