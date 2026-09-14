import { TenantService } from "../tenant.service";
import { Subscription, SubscriptionStatus, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSubscriptionDto } from "../../dto/subscription.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { StudentService } from "./student.service";
import { SubjectService } from "./subject.service";

export class SubscriptionService extends TenantService<Subscription> {
  private _studentService?: StudentService;
  private _subjectService?: SubjectService;

  constructor(tenantContext: TenantContext) {
    super("subscription", "subscription", tenantContext, true);
  }

  protected get studentService(): StudentService {
    if (!this._studentService) {
      this._studentService = new StudentService(this.tenantContext);
    }
    return this._studentService;
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  async subscribeStudent(dto: CreateSubscriptionDto) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة حالياً للاشتراك بها");
    }

    // 1. Verify student belongs to this library via StudentService
    const student = await this.studentService.findById(dto.studentId);
    Ensure.exists(student, "student", "الطالب غير موجود في هذه المكتبة");

    // 2. Verify subject belongs to this library via SubjectService
    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة في هذه المكتبة");

    // 3. Check if active subscription already exists for this exact tuple in the active period
    const existing = await this.findOne({
      studentId: dto.studentId,
      subjectId: dto.subjectId,
      featureType: dto.featureType as FeatureType,
      status: SubscriptionStatus.ACTIVE,
    });

    if (existing) {
      throw new BadRequestError("الطالب مشترك بالفعل في هذه الخدمة التعليمية لهذه المادة في هذه الفترة");
    }

    // 4. Create subscription (TenantService automatically injects libraryId & timePeriodId)
    const subscription = await this.create({
      studentId: dto.studentId,
      subjectId: dto.subjectId,
      featureType: dto.featureType as FeatureType,
      status: SubscriptionStatus.ACTIVE,
      subscribedAt: new Date(),
    });

    return subscription;
  }

  async cancelSubscription(id: string) {
    const subscription = await this.getById(id);
    Ensure.exists(subscription, "subscription");

    // Rule: Never physically delete subscriptions! Update status to CANCELLED instead.
    return await this.update(id, {
      status: SubscriptionStatus.CANCELLED,
    });
  }

  async expireActiveSubscriptions(timePeriodId: string) {
    return await this.updateMany(
      {
        timePeriodId,
        status: SubscriptionStatus.ACTIVE,
      },
      {
        status: SubscriptionStatus.EXPIRED,
        expiresAt: new Date(),
      }
    );
  }

  async fetchSubscriptions(options?: {
    studentId?: string;
    subjectId?: string;
    featureType?: string;
    status?: string;
    timePeriodId?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    // If explicit historical timePeriodId passed, override default period scope
    if (options?.timePeriodId) {
      where.timePeriodId = options.timePeriodId;
    }

    if (options?.studentId) {
      where.studentId = options.studentId;
    }

    if (options?.subjectId) {
      where.subjectId = options.subjectId;
    }

    if (options?.featureType) {
      where.featureType = options.featureType as FeatureType;
    }

    if (options?.status) {
      where.status = options.status as SubscriptionStatus;
    }

    return await this.getAllWithPagination({
      where,
      include: {
        student: { select: { id: true, fullName: true, phone: true } },
        subject: { select: { id: true, name: true, code: true } },
        timePeriod: { select: { id: true, name: true, status: true } },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async checkStudentFeatureAccess(studentId: string, subjectId: string, featureType: FeatureType): Promise<boolean> {
    if (!this.timePeriodId) return false;

    return await this.exists({
      studentId,
      subjectId,
      featureType,
      status: SubscriptionStatus.ACTIVE,
    });
  }
}
