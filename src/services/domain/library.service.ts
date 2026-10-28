import { RepoService } from "../repo.service";
import { Library, UserRole } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { CreateLibraryDto, UpdateLibraryDto } from "../../dto/library.dto";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { prisma } from "../../config/prisma";
import { StorageConfig } from "../../config/storage.config";
import { FileStorageService } from "../storage/file-storage.service";
import { AuthService } from "./auth.service";
import { TimePeriodService } from "./time-period.service";
import { StudentService } from "./student.service";
import { SubscriptionService } from "./subscription.service";

export class LibraryService extends RepoService<Library> {
  private _authService?: AuthService;
  private _studentService?: StudentService;
  private _subscriptionService?: SubscriptionService;

  constructor() {
    super("library", "library");
  }

  protected get authService(): AuthService {
    if (!this._authService) {
      this._authService = new AuthService();
    }
    return this._authService;
  }

  protected get studentService(): StudentService {
    if (!this._studentService) {
      this._studentService = new StudentService({ libraryId: "", isSuperAdmin: true });
    }
    return this._studentService;
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService({ libraryId: "", isSuperAdmin: true });
    }
    return this._subscriptionService;
  }

  async createLibraryWithAdmin(dto: CreateLibraryDto) {
    const existingCode = await this.findOne({
      code: dto.code.toUpperCase().trim(),
    });
    Ensure.alreadyExists(!!existingCode, "رمز المكتبة المعرف");

    const adminPhone = (dto.adminPhone || dto.admin?.phone || "").trim();
    Ensure.exists(adminPhone, "adminPhone", "رقم هاتف مدير المكتبة مطلوب");

    const existingPhone = await this.authService.findByPhone(adminPhone);
    Ensure.alreadyExists(!!existingPhone, "رقم هاتف المدير مسجل مسبقاً لمستخدم آخر");

    const rawPassword = dto.adminPassword || dto.admin?.password || "123456";
    const adminPasswordHash = await bcrypt.hash(rawPassword, 10);

    const library = await this.create({
      name: dto.name.trim(),
      code: dto.code.toUpperCase().trim(),
      phone: dto.phone?.trim(),
      address: dto.address?.trim(),
      logoUrl: dto.logoUrl?.trim(),
      primaryColor: dto.primaryColor || "#1a73e8",
      secondaryColor: dto.secondaryColor || "#34a853",
      isActive: true,
    });

    const adminFullName = (
      dto.adminFullName ||
      dto.adminName ||
      dto.admin?.fullName ||
      dto.admin?.name ||
      `مسؤول ${dto.name}`
    ).trim();

    const adminUser = await this.authService.createUser({
      phone: adminPhone,
      fullName: adminFullName,
      passwordHash: adminPasswordHash,
      role: UserRole.LIBRARY_ADMIN,
      libraryId: library.id,
      isActive: true,
    });

    // Automatically create the initial default active Time Period
    const currentYear = new Date().getFullYear();
    const periodName =
      dto.initialPeriodName ||
      dto.initialPeriod?.name ||
      `الفصل الدراسي الأول ${currentYear}/${currentYear + 1}`;
    const periodStartDate =
      dto.initialPeriodStartDate ||
      dto.initialPeriod?.startDate ||
      new Date().toISOString();

    const periodService = new TimePeriodService({ libraryId: library.id });
    const initialPeriod = await periodService.createPeriod({
      name: periodName,
      startDate: periodStartDate,
      activateNow: true,
    });

    return {
      library,
      admin: {
        id: adminUser.id,
        phone: adminUser.phone,
        fullName: adminUser.fullName,
      },
      initialPeriod,
    };
  }

  async fetchAllLibraries(options?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { code: { contains: options.search, mode: "insensitive" } },
        { phone: { contains: options.search, mode: "insensitive" } },
      ];
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return await this.getAllWithPagination({
      where,
      include: {
        admins: {
          select: {
            id: true,
            phone: true,
            email: true,
            fullName: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            students: true,
            branches: true,
            subjects: true,
            subscriptions: true,
          },
        },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async fetchLibraryDetails(id: string) {
    const library = await this.getById(id, {
      include: {
        admins: {
          select: {
            id: true,
            phone: true,
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
        timePeriods: {
          orderBy: { createdAt: "desc" },
        },
        branches: {
          include: {
            departments: true,
          },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
            subscriptions: true,
            lectures: true,
            goldMaterials: true,
            summaries: true,
            courses: true,
            questions: true,
          },
        },
      },
    });

    Ensure.exists(library, "library");
    return library;
  }

  async toggleLibraryStatus(id: string) {
    const library = await this.getById(id);
    Ensure.exists(library, "library");

    const updated = await this.update(id, {
      isActive: !library!.isActive,
    });

    return updated;
  }

  async getPlatformStats() {
    const [
      totalLibraries,
      activeLibraries,
      totalStudents,
      totalSubscriptions,
      activeSubscriptions,
    ] = await Promise.all([
      this.count(),
      this.count({ isActive: true }),
      this.studentService.count(),
      this.subscriptionService.count(),
      this.subscriptionService.count({ status: "ACTIVE" }),
    ]);

    return {
      totalLibraries,
      activeLibraries,
      totalStudents,
      totalSubscriptions,
      activeSubscriptions,
    };
  }

  async deleteLibraryPermanently(id: string) {
    const library = await this.getById(id);
    Ensure.exists(library, "library", "المكتبة المطلوبة غير موجودة");

    // 1. Fetch all stored files belonging to this library to delete from physical disk
    const storedFiles = await prisma.storedFile.findMany({
      where: { libraryId: id },
      select: { storageKey: true },
    });

    for (const file of storedFiles) {
      if (file.storageKey) {
        await FileStorageService.deletePhysicalFile(file.storageKey);
      }
    }

    // 2. Remove all subject folders belonging to this library from storage root
    const subjects = await prisma.subject.findMany({
      where: { libraryId: id },
      select: { id: true, name: true },
    });

    for (const subj of subjects) {
      const folderName = FileStorageService.getSubjectFolder(subj.name, subj.id);
      const folderPath = path.resolve(StorageConfig.STORAGE_ROOT, folderName);
      if (folderPath.startsWith(StorageConfig.STORAGE_ROOT) && fs.existsSync(folderPath)) {
        try {
          await fs.promises.rm(folderPath, { recursive: true, force: true });
        } catch (err) {
          console.error(`[deleteLibraryPermanently] Failed to remove subject folder ${folderPath}:`, err);
        }
      }
    }

    // 3. Atomically delete all records across all related tables in sequential dependency order
    await prisma.$transaction(async (tx) => {
      // Content & Files
      await tx.storedFile.deleteMany({ where: { libraryId: id } });
      await tx.lecture.deleteMany({ where: { libraryId: id } });
      await tx.goldMaterial.deleteMany({ where: { libraryId: id } });
      await tx.summaryMaterial.deleteMany({ where: { libraryId: id } });

      const courses = await tx.course.findMany({
        where: { libraryId: id },
        select: { id: true },
      });
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length > 0) {
        await tx.courseLesson.deleteMany({
          where: { courseId: { in: courseIds } },
        });
      }
      await tx.course.deleteMany({ where: { libraryId: id } });
      await tx.questionBankItem.deleteMany({ where: { libraryId: id } });

      // Subscriptions & Requests & Communications
      await tx.subscriptionRequest.deleteMany({ where: { libraryId: id } });
      await tx.subscription.deleteMany({ where: { libraryId: id } });
      await tx.complaint.deleteMany({ where: { libraryId: id } });
      await tx.notification.deleteMany({ where: { libraryId: id } });

      // Students
      await tx.student.deleteMany({ where: { libraryId: id } });

      // Academic Hierarchy
      await tx.subject.deleteMany({ where: { libraryId: id } });
      await tx.academicYear.deleteMany({ where: { libraryId: id } });
      await tx.department.deleteMany({ where: { libraryId: id } });
      await tx.branch.deleteMany({ where: { libraryId: id } });

      // Time Periods
      await tx.timePeriod.deleteMany({ where: { libraryId: id } });

      // Library Admin Users
      await tx.user.deleteMany({ where: { libraryId: id } });

      // Library
      await tx.library.delete({ where: { id } });
    });

    return { success: true };
  }
}
