import { TenantService } from "../tenant.service";
import { Lecture, FeatureType, SubscriptionStatus } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateLectureDto, UpdateLectureDto } from "../../dto/lecture.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";
import { NotificationService } from "./notification.service";

export class LectureService extends TenantService<Lecture> {
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;
  private _notificationService?: NotificationService;

  constructor(tenantContext: TenantContext) {
    // Lecture is period-scoped: true
    super("lecture", "lecture", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(this.tenantContext);
    }
    return this._subscriptionService;
  }

  protected get notificationService(): NotificationService {
    if (!this._notificationService) {
      this._notificationService = new NotificationService(this.tenantContext);
    }
    return this._notificationService;
  }

  async createLecture(dto: CreateLectureDto) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لرفع المحاضرة");
    }

    // Verify subject belongs to library via SubjectService
    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة في هذه المكتبة");

    const lecture = await this.create({
      subjectId: dto.subjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      videoUrl: dto.videoUrl?.trim() || null,
      attachmentUrl: dto.attachmentUrl?.trim() || null,
      orderIndex: dto.orderIndex ?? 0,
    });

    // Educational Lecture Subscription behavior:
    // Auto-access: Active subscribers to the lecture service automatically have access to this new lecture.
    // Dispatch notification to all active subscribers of this subject/feature in this period
    const activeSubscribers = await this.subscriptionService.findMany({
      subjectId: dto.subjectId,
      featureType: FeatureType.LECTURES,
      status: SubscriptionStatus.ACTIVE,
    });

    if (activeSubscribers.length > 0) {
      await this.notificationService.createMany(
        activeSubscribers.map((sub: any) => ({
          studentId: sub.studentId,
          title: `محاضرة جديدة: ${dto.title}`,
          message: `تم رفع محاضرة جديدة لمادة ${subject!.name}، أصبحت متوفرة الآن في حسابك مباشرة.`,
          type: "LECTURE_UPLOAD",
        }))
      );
    }

    return {
      lecture,
      notifiedSubscribersCount: activeSubscribers.length,
    };
  }

  async updateLecture(id: string, dto: UpdateLectureDto) {
    return await this.update(id, {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      videoUrl: dto.videoUrl?.trim(),
      attachmentUrl: dto.attachmentUrl?.trim(),
      orderIndex: dto.orderIndex,
    });
  }

  async fetchLectures(subjectId?: string) {
    const where: any = {};

    // For students: enforce active subscription for FeatureType.LECTURES
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedSubjectIds = await this.subscriptionService.getStudentActiveSubscribedSubjectIds(
        this.tenantContext.userId,
        FeatureType.LECTURES
      );

      // If student has no active subscriptions for lectures, return empty immediately
      if (subscribedSubjectIds.length === 0) {
        return [];
      }

      if (subjectId) {
        if (!subscribedSubjectIds.includes(subjectId)) {
          return [];
        }
        where.subjectId = subjectId;
      } else {
        where.subjectId = { in: subscribedSubjectIds };
      }
    } else if (subjectId) {
      where.subjectId = subjectId;
    }

    return await this.getAll({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { orderIndex: "asc" },
    });
  }
}
