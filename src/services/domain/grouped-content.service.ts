import { TenantService } from "../tenant.service";
import { FeatureType, SubscriptionStatus, RequestStatus } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../common/errors/http.error";

export interface GroupedSubjectItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  academicYearId?: string | null;
  academicYearName?: string | null;
  yearLevel: number;
  departmentName?: string | null;
  isSubscribed: boolean;
  hasPendingRequest: boolean;
  pendingRequestId: string | null;
  isFreeTrial?: boolean;
  wasFreeTrialExpired?: boolean;
  items: any[];
}

export interface GroupedContentResponse {
  featureType: FeatureType;
  subscribed: GroupedSubjectItem[];
  unsubscribed: GroupedSubjectItem[];
}

export class GroupedContentService extends TenantService<any> {
  constructor(tenantContext: TenantContext) {
    super("subject", "subject", tenantContext, false);
  }

  async getGroupedContent(
    featureType: FeatureType,
    academicYearId?: string,
    yearLevel?: number
  ): Promise<GroupedContentResponse> {
    if (!this.timePeriodId) {
      return { featureType, subscribed: [], unsubscribed: [] };
    }

    const studentId = this.tenantContext.role === "STUDENT" ? this.tenantContext.userId : null;

    let studentBranchId: string | null = null;
    let studentDepartmentId: string | null = null;
    let studentAcademicYearId: string | null = null;

    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: {
          branchId: true,
          departmentId: true,
          academicYearId: true,
          freeTrialActive: true,
          freeTrialExpiresAt: true,
        },
      });
      if (student) {
        studentBranchId = student.branchId;
        studentDepartmentId = student.departmentId;
        studentAcademicYearId = student.academicYearId;
      }
    }

    // Find subjects strictly relevant to this student's department/branch (or all in library if admin)
    const subjectWhere: any = {
      libraryId: this.libraryId,
      isActive: true,
    };

    if (studentId) {
      if (studentBranchId) {
        subjectWhere.branchId = studentBranchId;
      }
      if (studentDepartmentId) {
        subjectWhere.departmentId = studentDepartmentId;
      } else {
        // Fallback for branches without departments
        subjectWhere.departmentId = null;
      }
    }

    if (academicYearId) {
      subjectWhere.academicYearId = academicYearId;
    } else if (yearLevel !== undefined) {
      subjectWhere.yearLevel = yearLevel;
    }

    const subjects = await prisma.subject.findMany({
      where: subjectWhere,
      include: {
        department: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true, yearOrder: true } },
      },
      orderBy: [{ academicYear: { yearOrder: "asc" } }, { name: "asc" }],
    });

    if (subjects.length === 0) {
      return { featureType, subscribed: [], unsubscribed: [] };
    }

    const subjectIds = subjects.map((s) => s.id);

    // Fetch active & expired subscriptions for this student and featureType in current period
    let activeSubscriptions: any[] = [];
    let pendingRequests: any[] = [];
    let expiredSubscriptions: any[] = [];
    const now = new Date();

    if (studentId) {
      // 1. Auto-expire any active subscriptions that have passed expiresAt
      await prisma.subscription.updateMany({
        where: {
          libraryId: this.libraryId,
          studentId,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { lte: now },
        },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });

      // 2. Fetch active subscriptions, pending requests, and expired subscriptions
      [activeSubscriptions, pendingRequests, expiredSubscriptions] = await Promise.all([
        prisma.subscription.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            studentId,
            featureType,
            status: SubscriptionStatus.ACTIVE,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        }),
        prisma.subscriptionRequest.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            studentId,
            featureType,
            status: RequestStatus.PENDING,
          },
        }),
        prisma.subscription.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            studentId,
            featureType,
            status: SubscriptionStatus.EXPIRED,
          },
        }),
      ]);
    }

    // Build lookup maps for fast access
    const activeSubscribedSubjectMap = new Map<string, any>();
    activeSubscriptions.filter((s) => !s.materialId).forEach((s) => {
      activeSubscribedSubjectMap.set(s.subjectId, s);
    });

    const activeSubscribedSubjectIds = new Set(
      activeSubscriptions.filter((s) => !s.materialId).map((s) => s.subjectId)
    );
    const activeSubscribedMaterialIds = new Set(
      activeSubscriptions.filter((s) => Boolean(s.materialId)).map((s) => s.materialId)
    );

    // Track expired free trials so we can mark returned subjects
    const expiredFreeTrialSubjectIds = new Set(
      expiredSubscriptions.filter((s) => s.isFreeTrial && !s.materialId).map((s) => s.subjectId)
    );

    // Pending requests map: subjectId -> requestId (for subject-level requests)
    const pendingSubjectRequestMap = new Map<string, string>();
    // Pending requests map: materialId -> requestId (for material-level requests)
    const pendingMaterialRequestMap = new Map<string, string>();

    pendingRequests.forEach((req) => {
      if (req.materialId) {
        pendingMaterialRequestMap.set(req.materialId, req.id);
      } else {
        pendingSubjectRequestMap.set(req.subjectId, req.id);
      }
    });

    // Fetch items for the specified featureType
    let allItems: any[] = [];

    switch (featureType) {
      case FeatureType.LECTURES:
        allItems = await prisma.lecture.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            subjectId: { in: subjectIds },
          },
          include: {
            file: {
              select: {
                id: true,
                originalName: true,
                size: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          orderBy: { orderIndex: "asc" },
        });
        break;

      case FeatureType.GOLD_PAPERS:
        allItems = await prisma.goldMaterial.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            subjectId: { in: subjectIds },
          },
          include: {
            file: {
              select: {
                id: true,
                originalName: true,
                size: true,
                mimeType: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        break;

      case FeatureType.SUMMARIES:
        allItems = await prisma.summaryMaterial.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            subjectId: { in: subjectIds },
          },
          include: {
            file: {
              select: {
                id: true,
                originalName: true,
                size: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        break;

      case FeatureType.COURSES:
        allItems = await prisma.course.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            subjectId: { in: subjectIds },
          },
          include: {
            lessons: true,
          },
          orderBy: { createdAt: "desc" },
        });
        break;

      case FeatureType.QUESTION_BANK:
        allItems = await prisma.questionBankItem.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            subjectId: { in: subjectIds },
          },
          include: {
            file: {
              select: {
                id: true,
                originalName: true,
                size: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        break;

      default:
        throw new BadRequestError(`نوع الميزة ${featureType} غير مدعوم`);
    }

    // Group items by subjectId
    const itemsBySubject = new Map<string, any[]>();
    allItems.forEach((item) => {
      const existing = itemsBySubject.get(item.subjectId) || [];
      existing.push(item);
      itemsBySubject.set(item.subjectId, existing);
    });

    const subscribed: GroupedSubjectItem[] = [];
    const unsubscribed: GroupedSubjectItem[] = [];

    for (const sub of subjects) {
      const subjectItems = itemsBySubject.get(sub.id) || [];

      if (!studentId) {
        // For admin: put all into subscribed list with all items
        subscribed.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          academicYearId: sub.academicYearId || null,
          academicYearName: sub.academicYear?.name || (sub.yearLevel ? `السنة ${sub.yearLevel}` : null),
          yearLevel: sub.yearLevel || 1,
          departmentName: sub.department?.name || null,
          isSubscribed: true,
          hasPendingRequest: false,
          pendingRequestId: null,
          items: subjectItems,
        });
        continue;
      }

      // Feature-specific subscription architecture:
      // 1. LECTURES: Subscription is subject-wide (covers all present and future lectures of this subject)
      if (featureType === FeatureType.LECTURES) {
        const activeSub = activeSubscribedSubjectMap.get(sub.id);
        const isSubscribedToSubject = Boolean(activeSub);
        const hasPendingReq = pendingSubjectRequestMap.has(sub.id);
        const pendingReqId = pendingSubjectRequestMap.get(sub.id) || null;

        if (isSubscribedToSubject) {
          subscribed.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            academicYearId: sub.academicYearId || null,
            academicYearName: sub.academicYear?.name || (sub.yearLevel ? `السنة ${sub.yearLevel}` : null),
            yearLevel: sub.yearLevel || 1,
            departmentName: sub.department?.name || null,
            isSubscribed: true,
            hasPendingRequest: false,
            pendingRequestId: null,
            isFreeTrial: Boolean(activeSub?.isFreeTrial),
            items: subjectItems,
          });
        } else {
          // Unsubscribed lectures subject
          const wasExpiredTrial = expiredFreeTrialSubjectIds.has(sub.id);
          const sanitizedItems = subjectItems.map((item) => ({
            ...item,
            fileId: null,
            file: item.file ? { originalName: item.file.originalName, size: item.file.size } : null,
            hasPendingRequest: hasPendingReq,
            pendingRequestId: pendingReqId,
          }));

          unsubscribed.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            academicYearId: sub.academicYearId || null,
            academicYearName: sub.academicYear?.name || (sub.yearLevel ? `السنة ${sub.yearLevel}` : null),
            yearLevel: sub.yearLevel || 1,
            departmentName: sub.department?.name || null,
            isSubscribed: false,
            hasPendingRequest: hasPendingReq,
            pendingRequestId: pendingReqId,
            wasFreeTrialExpired: wasExpiredTrial,
            items: sanitizedItems,
          });
        }
      } else {
        // 2. OTHER FEATURES (SUMMARIES, GOLD_PAPERS, COURSES, QUESTION_BANK):
        // Subscription is STRICTLY per-item (materialId). Subscribing to one item never grants access to others.
        const subscribedMaterials = subjectItems.filter((item) =>
          activeSubscribedMaterialIds.has(item.id)
        );
        const unsubscribedMaterials = subjectItems.filter(
          (item) => !activeSubscribedMaterialIds.has(item.id)
        );

        // Subscribed tab: contains subjects that have at least one subscribed material
        if (subscribedMaterials.length > 0) {
          subscribed.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            academicYearId: sub.academicYearId || null,
            academicYearName: sub.academicYear?.name || (sub.yearLevel ? `السنة ${sub.yearLevel}` : null),
            yearLevel: sub.yearLevel || 1,
            departmentName: sub.department?.name || null,
            isSubscribed: true,
            hasPendingRequest: false,
            pendingRequestId: null,
            items: subscribedMaterials,
          });
        }

        // Unsubscribed tab: contains subjects with remaining unsubscribed materials
        if (unsubscribedMaterials.length > 0) {
          const sanitizedUnsubscribedItems = unsubscribedMaterials.map((item) => ({
            ...item,
            fileId: null,
            file: item.file ? { originalName: item.file.originalName, size: item.file.size } : null,
            hasPendingRequest: pendingMaterialRequestMap.has(item.id),
            pendingRequestId: pendingMaterialRequestMap.get(item.id) || null,
          }));

          unsubscribed.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            academicYearId: sub.academicYearId || null,
            academicYearName: sub.academicYear?.name || (sub.yearLevel ? `السنة ${sub.yearLevel}` : null),
            yearLevel: sub.yearLevel || 1,
            departmentName: sub.department?.name || null,
            isSubscribed: false,
            hasPendingRequest: false,
            pendingRequestId: null,
            items: sanitizedUnsubscribedItems,
          });
        }
      }
    }

    return {
      featureType,
      subscribed,
      unsubscribed,
    };
  }
}
