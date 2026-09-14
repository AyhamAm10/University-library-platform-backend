import { TenantService } from "../tenant.service";
import { TimePeriod, PeriodStatus } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { TenantContext } from "../../types/tenant.context";
import {
  CreateTimePeriodDto,
  UpdateTimePeriodDto,
  CopyContentDto,
} from "../../dto/time-period.dto";
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

  async createPeriod(dto: CreateTimePeriodDto) {
    const activate = dto.activateNow ?? true;

    if (activate) {
      // Find existing active period
      const currentActive = await this.getCurrentActivePeriod();

      if (currentActive) {
        // 1. Archive the existing period
        await this.update(currentActive.id, {
          status: PeriodStatus.ARCHIVED,
        });

        // 2. Mark its active subscriptions as EXPIRED (Never deleted!)
        await this.subscriptionService.expireActiveSubscriptions(currentActive.id);
      }
    }

    const newPeriod = await this.create({
      name: dto.name.trim(),
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      status: activate ? PeriodStatus.ACTIVE : PeriodStatus.ARCHIVED,
    });

    return newPeriod;
  }

  async activatePeriod(periodId: string) {
    const targetPeriod = await this.findById(periodId);
    Ensure.exists(targetPeriod, "timePeriod");

    if (targetPeriod!.status === PeriodStatus.ACTIVE) {
      return targetPeriod;
    }

    // Find current active period and archive it
    const currentActive = await this.getCurrentActivePeriod();

    if (currentActive) {
      await this.update(currentActive.id, {
        status: PeriodStatus.ARCHIVED,
      });

      await this.subscriptionService.expireActiveSubscriptions(currentActive.id);
    }

    // Activate target period
    const activated = await this.update(periodId, {
      status: PeriodStatus.ACTIVE,
    });

    return activated;
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
          videoUrl: original!.videoUrl,
          attachmentUrl: original!.attachmentUrl,
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
          fileUrl: original!.fileUrl,
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

    // Clean period scoped data through their respective domain services
    await this.lectureService.deleteMany({ timePeriodId: periodId });
    await this.goldService.deleteMany({ timePeriodId: periodId });
    await this.summaryService.deleteMany({ timePeriodId: periodId });
    await this.questionBankService.deleteMany({ timePeriodId: periodId });
    await this.courseService.deleteCoursesForPeriod(periodId);
    await this.subscriptionService.deleteMany({ timePeriodId: periodId });

    // Delete time period
    await this.delete(periodId);

    return { cleanedPeriodId: periodId };
  }
}
