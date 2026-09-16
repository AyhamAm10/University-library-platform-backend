import { TenantService } from "../tenant.service";
import { SubscriptionRequest, RequestStatus, SubscriptionStatus, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateSubscriptionRequestDto } from "../../dto/subscription-request.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { StudentService } from "./student.service";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";
import { NotificationService } from "./notification.service";
import { prisma } from "../../config/prisma";

export class SubscriptionRequestService extends TenantService<SubscriptionRequest> {
  private _studentService?: StudentService;
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;
  private _notificationService?: NotificationService;

  constructor(tenantContext: TenantContext) {
    super("subscriptionRequest", "subscription_request", tenantContext, true);
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

  async createRequest(dto: CreateSubscriptionRequestDto, studentId: string) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة حالياً لتقديم الطلبات");
    }

    const student = await this.studentService.findById(studentId);
    Ensure.exists(student, "student", "الطالب غير موجود في هذه المكتبة");

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة");

    // 1. Check if student is already actively subscribed
    const whereSub: any = {
      studentId,
      subjectId: dto.subjectId,
      featureType: dto.featureType as FeatureType,
      status: SubscriptionStatus.ACTIVE,
    };
    if (dto.materialId) {
      whereSub.materialId = dto.materialId;
    } else if (dto.featureType === FeatureType.LECTURES) {
      whereSub.materialId = null;
    }

    const existingSub = await this.subscriptionService.findOne(whereSub);
    if (existingSub) {
      throw new BadRequestError("أنت مشترك بالفعل في هذه الخدمة التعليمية لهذه المادة");
    }

    // 2. Check if student already has a pending request for this item
    const whereReq: any = {
      studentId,
      subjectId: dto.subjectId,
      featureType: dto.featureType as FeatureType,
      status: RequestStatus.PENDING,
    };
    if (dto.materialId) {
      whereReq.materialId = dto.materialId;
    } else {
      whereReq.materialId = null;
    }

    const existingReq = await this.findOne(whereReq);
    if (existingReq) {
      throw new BadRequestError("لديك طلب اشتراك قيد المراجعة بالفعل لهذا المحتوى، يرجى انتظار معالجته من قبل الإدارة");
    }

    // 3. Create the subscription request
    const request = await this.create({
      studentId,
      subjectId: dto.subjectId,
      featureType: dto.featureType as FeatureType,
      materialId: dto.materialId || null,
      status: RequestStatus.PENDING,
      notes: dto.notes || null,
    });

    return request;
  }

  async fetchRequests(options?: {
    studentId?: string;
    subjectId?: string;
    featureType?: string;
    status?: string;
    timePeriodId?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

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
      where.status = options.status as RequestStatus;
    }

    const result = await this.getAllWithPagination({
      where,
      include: {
        student: { select: { id: true, fullName: true, phone: true, studentCode: true } },
        subject: { select: { id: true, name: true, code: true } },
        timePeriod: { select: { id: true, name: true, status: true } },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });

    // Enrich with material details if materialId is set
    const materialIds = result.data
      .map((r: any) => r.materialId)
      .filter((id): id is string => Boolean(id));

    let materialMap: Record<string, { id: string; title: string }> = {};

    if (materialIds.length > 0) {
      const [golds, summaries, questions] = await Promise.all([
        (prisma as any).goldMaterial.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true },
        }),
        (prisma as any).summaryMaterial.findMany({
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
      questions.forEach((q: any) => { materialMap[q.id] = { id: q.id, title: q.title || q.questionText }; });
    }

    const enriched = result.data.map((req: any) => ({
      ...req,
      material: req.materialId ? materialMap[req.materialId] || null : null,
    }));

    return {
      ...result,
      data: enriched,
    };
  }

  async approveRequest(id: string, notes?: string) {
    const request = (await this.getById(id, {
      include: { subject: true, student: true },
    })) as any;
    Ensure.exists(request, "subscriptionRequest", "طلب الاشتراك غير موجود");

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestError("لا يمكن معالجة هذا الطلب لأنه تمت معالجته مسبقاً");
    }

    // 1. Activate subscription for the student
    const subscription = await this.subscriptionService.subscribeStudent({
      studentId: request.studentId,
      subjectId: request.subjectId,
      featureType: request.featureType,
      materialId: request.materialId || undefined,
    });

    // 2. Mark request as APPROVED
    const updatedRequest = await this.update(id, {
      status: RequestStatus.APPROVED,
      notes: notes || request.notes || null,
    });

    // 3. Dispatch notification to the student
    await this.notificationService.create({
      studentId: request.studentId,
      title: "تمت الموافقة على طلب اشتراكك",
      message: `تمت الموافقة على طلب اشتراكك في مادة (${request.subject?.name}) وتفعيله بنجاح. يمكنك الآن تصفح كامل المحتوى مباشرة.`,
      type: "SUBSCRIPTION_APPROVED",
    });

    return { request: updatedRequest, subscription };
  }

  async rejectRequest(id: string, notes?: string) {
    const request = (await this.getById(id, {
      include: { subject: true, student: true },
    })) as any;
    Ensure.exists(request, "subscriptionRequest", "طلب الاشتراك غير موجود");

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestError("لا يمكن رفض هذا الطلب لأنه تمت معالجته مسبقاً");
    }

    const updatedRequest = await this.update(id, {
      status: RequestStatus.REJECTED,
      notes: notes || request.notes || null,
    });

    // Dispatch notification to the student
    await this.notificationService.create({
      studentId: request.studentId,
      title: "تحديث بخصوص طلب الاشتراك",
      message: notes
        ? `نأسف، تم رفض طلب اشتراكك في مادة (${request.subject?.name}): ${notes}`
        : `نأسف، تم رفض طلب اشتراكك في مادة (${request.subject?.name}) من قبل إدارة المكتبة.`,
      type: "SUBSCRIPTION_REJECTED",
    });

    return updatedRequest;
  }
}
