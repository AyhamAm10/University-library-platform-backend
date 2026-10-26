import { TenantService } from "./tenant.service";
import { TenantContext } from "../types/tenant.context";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../config/prisma";

/**
 * AcademicContentService
 * ─────────────────────────────────────────────────────────────────────────────
 * طبقة وسيطة في سلسلة الوراثة:
 *   RepoService → TenantService → AcademicContentService → Domain Services
 *
 * المسؤولية الوحيدة لهذه الطبقة:
 *   إضافة فلترة `yearLevel` على مستوى المادة الدراسية (Subject) لضمان
 *   أن كل عملية قراءة أو كتابة للمحتوى الأكاديمي تتم ضمن نطاق السنة الدراسية
 *   الصحيحة المرتبطة بالمادة — دون أن تحمل المحاضرة أو الملخص أو غيرها أي
 *   علاقة مباشرة بالقسم أو السنة.
 *
 * كيف يعمل؟
 *   - resolveSubjectIds() → يجلب IDs المواد المفلترة بالقسم + السنة
 *   - buildAcademicWhere() → يبني شرط WHERE شامل: tenantWhere + subjectIds المفلترة
 *
 * ملاحظة: استدعاء هذه الدوال اختياري — خدمات المحتوى تستخدمها عند الحاجة
 * بينما تعمليات الإنشاء (create) تتحقق من المادة عبر SubjectService كما هو.
 */
export abstract class AcademicContentService<T = any> extends TenantService<T> {
  constructor(
    modelName: keyof PrismaClient,
    entityName: string,
    tenantContext: TenantContext,
    isPeriodScoped: boolean = true
  ) {
    super(modelName, entityName, tenantContext, isPeriodScoped);
  }

  /**
   * يجلب قائمة IDs المواد الدراسية المفلترة بـ:
   * - libraryId (من الـ tenant context)
   * - departmentId (من student أو يُمرّر صراحةً)
   * - branchId (اختياري)
   * - yearLevel (السنة الدراسية المطلوبة — اختياري يجلب كل السنوات)
   *
   * يُستخدم لبناء فلتر المحتوى الصحيح بدلاً من تخمين القسم من كل خدمة.
   */
  protected async resolveAcademicSubjectIds(options?: {
    departmentId?: string | null;
    branchId?: string | null;
    academicYearId?: string | null;
    yearLevel?: number;
    subjectId?: string; // إذا تم تحديد مادة بعينها يتحقق أنها ضمن النطاق
  }): Promise<string[]> {
    const where: any = {
      libraryId: this.libraryId,
      isActive: true,
    };

    if (options?.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options?.branchId !== undefined) {
      // مواد الفرع المحدد + المواد العامة للقسم (branchId = null)
      where.OR = [
        { branchId: options.branchId },
        { branchId: null },
      ];
    }

    if (options?.academicYearId) {
      where.academicYearId = options.academicYearId;
    } else if (options?.yearLevel !== undefined) {
      where.yearLevel = options.yearLevel;
    }

    if (options?.subjectId) {
      where.id = options.subjectId;
    }

    const subjects = await prisma.subject.findMany({
      where,
      select: { id: true },
    });

    return subjects.map((s) => s.id);
  }

  /**
   * يبني شرط WHERE أكاديمي شامل يدمج:
   * - الشروط الأساسية للـ tenant (libraryId + timePeriodId)
   * - فلترة الـ subjectIds المستخرجة من النطاق الأكاديمي
   * - أي شروط إضافية يمررها الـ caller
   */
  protected async buildAcademicContentWhere(
    options?: {
      departmentId?: string | null;
      branchId?: string | null;
      academicYearId?: string | null;
      yearLevel?: number;
      subjectId?: string;
    },
    extraWhere: any = {}
  ): Promise<any> {
    const subjectIds = await this.resolveAcademicSubjectIds(options);

    const tenantBase = this.buildTenantWhere({});

    return {
      ...tenantBase,
      subjectId: subjectIds.length > 0 ? { in: subjectIds } : undefined,
      ...extraWhere,
    };
  }

  /**
   * يجلب بيانات الطالب الحالي (departmentId + branchId + academicYearId) من الـ JWT
   * للاستخدام في بناء الشروط الأكاديمية تلقائياً في سياق الطالب.
   */
  protected async resolveStudentAcademicContext(): Promise<{
    departmentId: string | null;
    branchId: string | null;
    academicYearId: string | null;
  }> {
    if (this.tenantContext.role !== "STUDENT" || !this.tenantContext.userId) {
      return { departmentId: null, branchId: null, academicYearId: null };
    }

    const student = await prisma.student.findUnique({
      where: { id: this.tenantContext.userId },
      select: { departmentId: true, branchId: true, academicYearId: true },
    });

    return {
      departmentId: student?.departmentId ?? null,
      branchId: student?.branchId ?? null,
      academicYearId: student?.academicYearId ?? null,
    };
  }
}
