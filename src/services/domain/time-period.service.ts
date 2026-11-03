import { TenantService } from "../tenant.service";
import {
  TimePeriod,
  PeriodStatus,
  Prisma,
  FeatureType,
  SubscriptionStatus,
} from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { TenantContext } from "../../types/tenant.context";
import {
  CreateTimePeriodDto,
  CopyContentDto,
  ROLLOVER_CONFIRMATION,
} from "../../dto/time-period.dto";
import { prisma } from "../../config/prisma";
import { FileStorageService } from "../storage/file-storage.service";
import { SubscriptionService } from "./subscription.service";
import { LectureService } from "./lecture.service";
import { GoldService } from "./gold.service";
import { SummaryService } from "./summary.service";
import { CourseService } from "./course.service";
import { CourseLessonService } from "./course-lesson.service";
import { QuestionBankService } from "./question-bank.service";

export class TimePeriodService extends TenantService<TimePeriod> {
  private _subscriptionService?: SubscriptionService;
  private _lectureService?: LectureService;
  private _goldService?: GoldService;
  private _summaryService?: SummaryService;
  private _courseService?: CourseService;
  private _courseLessonService?: CourseLessonService;
  private _questionBankService?: QuestionBankService;

  constructor(tenantContext: TenantContext) {
    // TimePeriod belongs to library, so isPeriodScoped is false
    super("timePeriod", "timePeriod", tenantContext, false);
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(this.tenantContext);
    }
    return this._subscriptionService;
  }

  protected get lectureService(): LectureService {
    if (!this._lectureService) {
      this._lectureService = new LectureService(this.tenantContext);
    }
    return this._lectureService;
  }

  protected get goldService(): GoldService {
    if (!this._goldService) {
      this._goldService = new GoldService(this.tenantContext);
    }
    return this._goldService;
  }

  protected get summaryService(): SummaryService {
    if (!this._summaryService) {
      this._summaryService = new SummaryService(this.tenantContext);
    }
    return this._summaryService;
  }

  protected get courseService(): CourseService {
    if (!this._courseService) {
      this._courseService = new CourseService(this.tenantContext);
    }
    return this._courseService;
  }

  protected get courseLessonService(): CourseLessonService {
    if (!this._courseLessonService) {
      this._courseLessonService = new CourseLessonService();
    }
    return this._courseLessonService;
  }

  protected get questionBankService(): QuestionBankService {
    if (!this._questionBankService) {
      this._questionBankService = new QuestionBankService(this.tenantContext);
    }
    return this._questionBankService;
  }

  /**
   * فتح دورة جديدة (Rollover):
   * 1. أرشفة الدورة الحالية.
   * 2. نقل اشتراكاتها إلى جدول الأرشيف ثم حذفها مع طلبات الاشتراك من الجداول الحية.
   * 3. حذف المحاضرات والأوراق الذهبية والملخصات والكورسات مع ملفاتها.
   * 4. نقل بنك الأسئلة وملفاته إلى الدورة الجديدة (يبقى كما هو).
   * الطلاب والفروع والأقسام والسنوات والمواد لا تتأثر.
   * كل العمليات داخل Transaction واحدة، وحذف الملفات من التخزين يتم فقط بعد نجاحها.
   */
  async createPeriod(dto: CreateTimePeriodDto) {
    const activate = dto.activateNow ?? true;

    if (!activate) {
      return await this.create({
        name: dto.name.trim(),
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: PeriodStatus.ARCHIVED,
      });
    }

    const libraryId = this.requireLibraryId();
    const currentActive = await this.getCurrentActivePeriod();
    if (currentActive && dto.confirmation !== ROLLOVER_CONFIRMATION) {
      throw new BadRequestError(
        "فتح دورة جديدة سيؤرشف اشتراكات الدورة الحالية ويحذف المحاضرات والملخصات والأوراق الذهبية والكورسات وملفاتها نهائياً. يرجى تأكيد العملية"
      );
    }

    const { newPeriod, report, storageKeys } = await prisma.$transaction(
      async (tx) => {
        // قفل على مستوى المكتبة يمنع فتح دورتين بالتوازي
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${libraryId}))`;

        const previous = await tx.timePeriod.findFirst({
          where: { libraryId, status: PeriodStatus.ACTIVE },
        });

        const created = await tx.timePeriod.create({
          data: {
            libraryId,
            name: dto.name.trim(),
            startDate: new Date(dto.startDate),
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            status: PeriodStatus.ACTIVE,
          },
        });

        if (!previous) {
          return { newPeriod: created, report: null, storageKeys: [] as string[] };
        }

        await tx.timePeriod.update({
          where: { id: previous.id },
          data: { status: PeriodStatus.ARCHIVED, endDate: previous.endDate ?? new Date() },
        });

        const archivedSubscriptions = await this.archivePeriodSubscriptions(tx, libraryId, previous);
        const purge = await this.purgePeriodContent(tx, libraryId, previous.id);

        // بنك الأسئلة يبقى وينتقل للدورة الجديدة مع ملفاته
        const movedQuestions = await tx.questionBankItem.updateMany({
          where: { libraryId, timePeriodId: previous.id },
          data: { timePeriodId: created.id },
        });
        await tx.storedFile.updateMany({
          where: { libraryId, timePeriodId: previous.id, featureType: FeatureType.QUESTION_BANK },
          data: { timePeriodId: created.id },
        });

        return {
          newPeriod: created,
          storageKeys: purge.storageKeys,
          report: {
            archivedPeriod: { id: previous.id, name: previous.name },
            archivedSubscriptions,
            deletedLectures: purge.lectures,
            deletedGoldMaterials: purge.goldMaterials,
            deletedSummaries: purge.summaries,
            deletedCourses: purge.courses,
            deletedFiles: purge.storageKeys.length,
            keptQuestions: movedQuestions.count,
          },
        };
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    await this.deletePhysicalFiles(storageKeys);

    return { ...newPeriod, rollover: report };
  }

  async activatePeriod(periodId: string) {
    const targetPeriod = await this.findById(periodId);
    Ensure.exists(targetPeriod, "timePeriod");

    if (targetPeriod!.status === PeriodStatus.ACTIVE) {
      return targetPeriod;
    }

    // محتوى الدورات المؤرشفة محذوف واشتراكاتها في الأرشيف، لذا لا يُسمح بالعودة إليها
    const currentActive = await this.getCurrentActivePeriod();
    if (currentActive) {
      throw new BadRequestError(
        "لا يمكن إعادة تفعيل دورة مؤرشفة أثناء وجود دورة نشطة. لبدء فصل جديد أنشئ دورة جديدة"
      );
    }

    return await this.update(periodId, {
      status: PeriodStatus.ACTIVE,
    });
  }

  async getPeriods() {
    return await this.getAll({
      include: {
        _count: {
          select: {
            subscriptions: true,
            lectures: true,
            goldMaterials: true,
            summaries: true,
            courses: true,
            questions: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });
  }

  async getCurrentActivePeriod() {
    return await this.findOne(
      { status: PeriodStatus.ACTIVE },
      {
        include: {
          _count: {
            select: {
              subscriptions: true,
              lectures: true,
              goldMaterials: true,
              summaries: true,
              courses: true,
              questions: true,
            },
          },
        },
      }
    );
  }

  async copyContentToCurrentPeriod(dto: CopyContentDto) {
    const activePeriod = await this.getCurrentActivePeriod();
    if (!activePeriod) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة حالياً لنسخ المحتوى إليها");
    }

    const { contentType, sourceContentId, targetSubjectId } = dto;

    switch (contentType) {
      case "LECTURE": {
        const original = await this.lectureService.findById(sourceContentId);
        Ensure.exists(original, "محاضرة");

        return await this.lectureService.create({
          timePeriodId: activePeriod.id,
          subjectId: targetSubjectId || original!.subjectId,
          title: `${original!.title} (منسوخ)`,
          description: original!.description,
          fileId: (original as any)!.fileId,
          orderIndex: original!.orderIndex,
        });
      }
      case "GOLD": {
        const original = await this.goldService.findById(sourceContentId);
        Ensure.exists(original, "أوراق ذهبية");

        return await this.goldService.create({
          timePeriodId: activePeriod.id,
          subjectId: targetSubjectId || original!.subjectId,
          title: `${original!.title} (منسوخ)`,
          description: original!.description,
          fileUrl: original!.fileUrl,
        });
      }
      case "SUMMARY": {
        const original = await this.summaryService.findById(sourceContentId);
        Ensure.exists(original, "ملخص");

        return await this.summaryService.create({
          timePeriodId: activePeriod.id,
          subjectId: targetSubjectId || original!.subjectId,
          title: `${original!.title} (منسوخ)`,
          description: original!.description,
          fileId: (original as any)!.fileId,
        });
      }
      case "COURSE": {
        const original = await this.courseService.getCourseWithLessons(sourceContentId);
        Ensure.exists(original, "دورة");

        const newCourse = await this.courseService.create({
          timePeriodId: activePeriod.id,
          subjectId: targetSubjectId || (original as any)!.subjectId,
          title: `${(original as any)!.title} (منسوخ)`,
          description: (original as any)!.description,
          thumbnailUrl: (original as any)!.thumbnailUrl,
        });

        if ((original as any)!.lessons && (original as any)!.lessons.length > 0) {
          await this.courseLessonService.copyLessons((original as any)!.lessons, newCourse.id);
        }

        return newCourse;
      }
      case "QUESTION": {
        const original = await this.questionBankService.findById(sourceContentId);
        Ensure.exists(original, "سؤال بنك الأسئلة");

        return await this.questionBankService.create({
          timePeriodId: activePeriod.id,
          subjectId: targetSubjectId || original!.subjectId,
          questionText: original!.questionText,
          questionType: original!.questionType,
          options: original!.options as any,
          correctAnswer: original!.correctAnswer,
          explanation: original!.explanation,
          difficulty: original!.difficulty,
        });
      }
      default:
        throw new BadRequestError("نوع المحتوى غير معتمد");
    }
  }

  async cleanOldPeriod(periodId: string) {
    const period = await this.findById(periodId);
    Ensure.exists(period, "timePeriod");

    if (period!.status === PeriodStatus.ACTIVE) {
      throw new BadRequestError("لا يمكن حذف أو تنظيف الفترة الزمنية النشطة حالياً");
    }

    const libraryId = this.requireLibraryId();

    // الاشتراكات تُنقل للأرشيف ولا تُحذف، وسجل الدورة نفسه يبقى كمرجع للأرشيف
    const { storageKeys, archivedSubscriptions } = await prisma.$transaction(
      async (tx) => {
        const archived = await this.archivePeriodSubscriptions(tx, libraryId, period!);
        const purge = await this.purgePeriodContent(tx, libraryId, periodId);
        await tx.questionBankItem.deleteMany({ where: { libraryId, timePeriodId: periodId } });
        return { storageKeys: purge.storageKeys, archivedSubscriptions: archived };
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    await this.deletePhysicalFiles(storageKeys);

    return { cleanedPeriodId: periodId, archivedSubscriptions, deletedFiles: storageKeys.length };
  }

  private requireLibraryId(): string {
    if (!this.libraryId) {
      throw new BadRequestError("يجب تحديد المكتبة لتنفيذ هذه العملية");
    }
    return this.libraryId;
  }

  /**
   * ينسخ اشتراكات الدورة إلى جدول الأرشيف كلقطة نصية ثم يحذفها مع طلبات الاشتراك.
   */
  private async archivePeriodSubscriptions(
    tx: Prisma.TransactionClient,
    libraryId: string,
    period: TimePeriod
  ): Promise<number> {
    const subscriptions = await tx.subscription.findMany({
      where: { libraryId, timePeriodId: period.id },
      include: {
        student: { select: { fullName: true, phone: true } },
        subject: { select: { name: true } },
      },
    });

    if (subscriptions.length > 0) {
      const materialIds = subscriptions
        .map((s) => s.materialId)
        .filter((id): id is string => Boolean(id));
      const materialTitles = await this.resolveMaterialTitles(tx, materialIds);
      const now = new Date();

      await tx.subscriptionArchive.createMany({
        data: subscriptions.map((s) => ({
          libraryId,
          timePeriodId: period.id,
          timePeriodName: period.name,
          originalSubscriptionId: s.id,
          studentId: s.studentId,
          studentName: s.student.fullName,
          studentPhone: s.student.phone,
          subjectId: s.subjectId,
          subjectName: s.subject.name,
          featureType: s.featureType,
          materialId: s.materialId,
          materialTitle: s.materialId ? materialTitles.get(s.materialId) ?? null : null,
          status: s.status === SubscriptionStatus.ACTIVE ? SubscriptionStatus.EXPIRED : s.status,
          isFreeTrial: s.isFreeTrial,
          subscribedAt: s.subscribedAt,
          expiresAt: s.expiresAt ?? now,
        })),
      });
    }

    await tx.subscription.deleteMany({ where: { libraryId, timePeriodId: period.id } });
    await tx.subscriptionRequest.deleteMany({ where: { libraryId, timePeriodId: period.id } });

    return subscriptions.length;
  }

  private async resolveMaterialTitles(
    tx: Prisma.TransactionClient,
    ids: string[]
  ): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    if (ids.length === 0) return titles;

    const where = { id: { in: ids } };
    const [golds, summaries, courses, questions] = await Promise.all([
      tx.goldMaterial.findMany({ where, select: { id: true, title: true } }),
      tx.summaryMaterial.findMany({ where, select: { id: true, title: true } }),
      tx.course.findMany({ where, select: { id: true, title: true } }),
      tx.questionBankItem.findMany({ where, select: { id: true, title: true, questionText: true } }),
    ]);

    golds.forEach((g) => titles.set(g.id, g.title));
    summaries.forEach((s) => titles.set(s.id, s.title));
    courses.forEach((c) => titles.set(c.id, c.title));
    questions.forEach((q) => titles.set(q.id, q.title || q.questionText || "سؤال"));

    return titles;
  }

  /**
   * يحذف المحاضرات والأوراق الذهبية والملخصات والكورسات للدورة مع سجلات ملفاتها،
   * ويعيد مفاتيح التخزين لحذفها فعلياً بعد نجاح الـ Transaction.
   * الملف المستخدم من محتوى آخر خارج هذه الدورة لا يُحذف.
   */
  private async purgePeriodContent(
    tx: Prisma.TransactionClient,
    libraryId: string,
    periodId: string
  ) {
    const scope = { libraryId, timePeriodId: periodId };
    const [lectures, golds, summaries] = await Promise.all([
      tx.lecture.findMany({ where: scope, select: { fileId: true } }),
      tx.goldMaterial.findMany({ where: scope, select: { fileId: true } }),
      tx.summaryMaterial.findMany({ where: scope, select: { fileId: true } }),
    ]);

    const linkedFileIds = [...lectures, ...golds, ...summaries]
      .map((item) => item.fileId)
      .filter((id): id is string => Boolean(id));

    const candidateFiles = await tx.storedFile.findMany({
      where: {
        libraryId,
        OR: [
          { id: { in: linkedFileIds } },
          {
            timePeriodId: periodId,
            featureType: { in: [FeatureType.LECTURES, FeatureType.GOLD_PAPERS, FeatureType.SUMMARIES] },
          },
        ],
      },
      select: { id: true, storageKey: true },
    });

    await tx.lecture.deleteMany({ where: scope });
    await tx.goldMaterial.deleteMany({ where: scope });
    await tx.summaryMaterial.deleteMany({ where: scope });
    await tx.courseLesson.deleteMany({ where: { course: scope } });
    const courses = await tx.course.deleteMany({ where: scope });

    const candidateIds = candidateFiles.map((f) => f.id);
    const stillUsed = new Set<string>();
    if (candidateIds.length > 0) {
      const usedWhere = { fileId: { in: candidateIds } };
      const [l, g, s, q] = await Promise.all([
        tx.lecture.findMany({ where: usedWhere, select: { fileId: true } }),
        tx.goldMaterial.findMany({ where: usedWhere, select: { fileId: true } }),
        tx.summaryMaterial.findMany({ where: usedWhere, select: { fileId: true } }),
        tx.questionBankItem.findMany({ where: usedWhere, select: { fileId: true } }),
      ]);
      [...l, ...g, ...s, ...q].forEach((item) => item.fileId && stillUsed.add(item.fileId));
    }

    const deletableFiles = candidateFiles.filter((f) => !stillUsed.has(f.id));
    if (deletableFiles.length > 0) {
      await tx.storedFile.deleteMany({ where: { id: { in: deletableFiles.map((f) => f.id) } } });
    }

    return {
      lectures: lectures.length,
      goldMaterials: golds.length,
      summaries: summaries.length,
      courses: courses.count,
      storageKeys: deletableFiles.map((f) => f.storageKey).filter(Boolean),
    };
  }

  private async deletePhysicalFiles(storageKeys: string[]) {
    for (const key of storageKeys) {
      await FileStorageService.deletePhysicalFile(key);
    }
  }
}
