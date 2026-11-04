import { TenantService } from "../tenant.service";
import {
  FeatureType,
  Notification,
  NotificationCategory,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { prisma } from "../../config/prisma";
import { logger } from "../../logging/logger";
import { FirebasePushService } from "../push/firebase-push.service";
import { CreateAnnouncementDto } from "../../dto/notification.dto";

/** بيانات الانتقال داخل التطبيق عند الضغط على الإشعار */
export interface NotificationLinkData {
  featureType?: FeatureType;
  subjectId?: string;
  academicYearId?: string | null;
  itemId?: string;
}

export interface NotificationAudience {
  branchId?: string | null;
  departmentId?: string | null;
  academicYearId?: string | null;
  label?: string;
}

interface DispatchInput {
  category: NotificationCategory;
  title: string;
  message: string;
  studentIds: string[];
  data?: NotificationLinkData;
  audience?: NotificationAudience;
  createdById?: string | null;
}

const RECIPIENTS_BATCH_SIZE = 1000;

const NEW_CONTENT_LABELS: Record<FeatureType, string> = {
  LECTURES: "محاضرة جديدة",
  GOLD_PAPERS: "ورقة ذهبية جديدة",
  SUMMARIES: "ملخص جديد",
  COURSES: "كورس جديد",
  QUESTION_BANK: "أسئلة جديدة",
};

export class NotificationService extends TenantService<Notification> {
  constructor(tenantContext: TenantContext) {
    super("notification", "notification", tenantContext, false);
  }

  /**
   * ينشئ إشعاراً واحداً ويوزعه على صناديق وارد الطلاب، ثم يرسل الإشعار الفوري بدون انتظار.
   */
  async dispatch(input: DispatchInput): Promise<Notification | null> {
    const studentIds = Array.from(new Set(input.studentIds));
    if (studentIds.length === 0) return null;

    const notification = await prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          libraryId: this.libraryId,
          category: input.category,
          title: input.title,
          message: input.message,
          data: (input.data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          audience: (input.audience as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          createdById: input.createdById ?? null,
          recipientsCount: studentIds.length,
        },
      });

      for (let i = 0; i < studentIds.length; i += RECIPIENTS_BATCH_SIZE) {
        await tx.notificationRecipient.createMany({
          data: studentIds.slice(i, i + RECIPIENTS_BATCH_SIZE).map((studentId) => ({
            notificationId: created.id,
            studentId,
            libraryId: this.libraryId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // الإشعار الفوري لا يعطل الطلب الأصلي (رفع محاضرة مثلاً)
    void FirebasePushService.sendToStudents(studentIds, {
      title: input.title,
      body: input.message,
      data: this.toPushData(notification.id, input.category, input.data),
    }).catch((error) => logger.error(`[Push] ${error?.message ?? error}`));

    return notification;
  }

  async notifyStudent(
    studentId: string,
    input: Omit<DispatchInput, "studentIds" | "audience">
  ): Promise<Notification | null> {
    return await this.dispatch({ ...input, studentIds: [studentId] });
  }

  /**
   * إشعار "محتوى جديد": يصل لكل طالب يستطيع رؤية هذه المادة في التطبيق
   * (نفس الفرع، نفس القسم، ونفس السنة إن كانت محددة للطالب) — مشتركاً كان أم لا،
   * إضافة إلى أي طالب مشترك حالياً في المادة.
   * لا يرمي أخطاء حتى لا يفشل رفع المحتوى بسبب الإشعار.
   */
  async notifyNewContent(input: {
    featureType: FeatureType;
    subjectId: string;
    itemId: string;
    itemTitle: string;
  }): Promise<number> {
    try {
      const subject = await prisma.subject.findFirst({
        where: { id: input.subjectId, libraryId: this.libraryId },
        select: { id: true, name: true, branchId: true, departmentId: true, academicYearId: true },
      });
      if (!subject) return 0;

      // نفس منطق ظهور المواد للطالب في GroupedContentService
      const audienceStudents = await prisma.student.findMany({
        where: {
          libraryId: this.libraryId,
          isActive: true,
          departmentId: subject.departmentId,
          ...(subject.branchId ? { OR: [{ branchId: subject.branchId }, { branchId: null }] } : { branchId: null }),
          ...(subject.academicYearId
            ? { AND: [{ OR: [{ academicYearId: subject.academicYearId }, { academicYearId: null }] }] }
            : {}),
        },
        select: { id: true },
      });

      const subscribers = await prisma.subscription.findMany({
        where: {
          libraryId: this.libraryId,
          subjectId: subject.id,
          status: SubscriptionStatus.ACTIVE,
          ...(this.timePeriodId ? { timePeriodId: this.timePeriodId } : {}),
        },
        select: { studentId: true },
      });

      const studentIds = [...audienceStudents.map((s) => s.id), ...subscribers.map((s) => s.studentId)];

      const notification = await this.dispatch({
        category: NotificationCategory.NEW_CONTENT,
        title: `${NEW_CONTENT_LABELS[input.featureType]} في ${subject.name}`,
        message: input.itemTitle,
        studentIds,
        data: {
          featureType: input.featureType,
          subjectId: subject.id,
          academicYearId: subject.academicYearId,
          itemId: input.itemId,
        },
        audience: {
          branchId: subject.branchId,
          departmentId: subject.departmentId,
          academicYearId: subject.academicYearId,
          label: `طلاب مادة ${subject.name}`,
        },
      });

      return notification?.recipientsCount ?? 0;
    } catch (error) {
      logger.error(`[Notification] notifyNewContent failed: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * إشعار يدوي من إدارة المكتبة لطلابها فقط، مع إمكانية التحديد بالفرع/القسم/السنة.
   */
  async createAnnouncement(dto: CreateAnnouncementDto, createdById: string) {
    // السنة غير مخزنة غالباً على الطالب (يرى كل سنوات فرعه/قسمه في التطبيق)،
    // لذلك تحديد سنة يشمل: طلاب السنة + الطلاب بلا سنة محددة في نفس الفرع/القسم
    // (نفس منطق ظهور المواد) + أي مشترك حالياً في مادة من مواد هذه السنة.
    const students = await prisma.student.findMany({
      where: {
        libraryId: this.libraryId,
        isActive: true,
        ...(dto.branchId ? { branchId: dto.branchId } : {}),
        ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
        ...(dto.academicYearId
          ? { OR: [{ academicYearId: dto.academicYearId }, { academicYearId: null }] }
          : {}),
      },
      select: { id: true },
    });

    const yearSubscribers = dto.academicYearId
      ? await prisma.subscription.findMany({
          where: {
            libraryId: this.libraryId,
            status: SubscriptionStatus.ACTIVE,
            ...(this.timePeriodId ? { timePeriodId: this.timePeriodId } : {}),
            subject: { academicYearId: dto.academicYearId },
            student: { isActive: true },
          },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      : [];

    const studentIds = Array.from(
      new Set([...students.map((s) => s.id), ...yearSubscribers.map((s) => s.studentId)])
    );

    const notification = await this.dispatch({
      category: NotificationCategory.ANNOUNCEMENT,
      title: dto.title.trim(),
      message: dto.message.trim(),
      studentIds,
      audience: {
        branchId: dto.branchId ?? null,
        departmentId: dto.departmentId ?? null,
        academicYearId: dto.academicYearId ?? null,
        label: dto.audienceLabel?.trim() || "كل طلاب المكتبة",
      },
      createdById,
    });

    return { notification, recipientsCount: studentIds.length };
  }

  /**
   * سجل الإشعارات المرسلة مع عدد من قرأها (للوحة التحكم).
   */
  async listSent(options: { page?: number; limit?: number; category?: string }) {
    // يقبل نوعاً واحداً أو عدة أنواع مفصولة بفاصلة (مثل: SUBSCRIPTION,COMPLAINT,SYSTEM)
    const categories = (options.category || "")
      .split(",")
      .map((c) => c.trim())
      .filter((c): c is NotificationCategory => c in NotificationCategory);

    const result = await this.getAllWithPagination({
      where: categories.length > 0 ? { category: { in: categories } } : {},
      include: {
        // اسم الطالب للإشعارات الفردية
        recipients: { take: 1, select: { student: { select: { fullName: true } } } },
      },
      page: options.page,
      limit: options.limit,
      orderBy: { createdAt: "desc" },
    });

    // الأعداد من سجلات المستلمين الفعلية (أدق من recipientsCount المخزن للإشعارات القديمة)
    const ids = result.data.map((row: any) => row.id);
    const [totals, reads] = await Promise.all([
      prisma.notificationRecipient.groupBy({
        by: ["notificationId"],
        where: { notificationId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.notificationRecipient.groupBy({
        by: ["notificationId"],
        where: { notificationId: { in: ids }, readAt: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const totalById = new Map(totals.map((t) => [t.notificationId, t._count._all]));
    const readById = new Map(reads.map((r) => [r.notificationId, r._count._all]));

    return {
      ...result,
      data: result.data.map((row: any) => {
        const { recipients, ...rest } = row;
        const recipientsCount = totalById.get(row.id) ?? row.recipientsCount ?? 0;
        return {
          ...rest,
          recipientsCount,
          readCount: readById.get(row.id) ?? 0,
          recipientName: recipientsCount === 1 ? recipients?.[0]?.student?.fullName ?? null : null,
        };
      }),
    };
  }

  /**
   * ملخص الإشعارات للوحة التحكم: الأعداد حسب المجموعة، الوصول، ونسبة القراءة.
   */
  async getStats() {
    const personal = [NotificationCategory.SUBSCRIPTION, NotificationCategory.COMPLAINT, NotificationCategory.SYSTEM];

    const [total, announcements, newContent, personalCount, delivered, read, last] = await Promise.all([
      this.count({}),
      this.count({ category: NotificationCategory.ANNOUNCEMENT }),
      this.count({ category: NotificationCategory.NEW_CONTENT }),
      this.count({ category: { in: personal } }),
      prisma.notificationRecipient.count({ where: { libraryId: this.libraryId } }),
      prisma.notificationRecipient.count({ where: { libraryId: this.libraryId, readAt: { not: null } } }),
      this.findOne({}, { orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);

    return {
      total,
      announcements,
      newContent,
      personal: personalCount,
      delivered,
      read,
      readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      lastSentAt: (last as any)?.createdAt ?? null,
    };
  }

  /** FCM يقبل قيماً نصية فقط في data */
  private toPushData(
    notificationId: string,
    category: NotificationCategory,
    data?: NotificationLinkData
  ): Record<string, string> {
    const payload: Record<string, string> = { notificationId, category };
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) payload[key] = String(value);
      });
    }
    return payload;
  }
}
