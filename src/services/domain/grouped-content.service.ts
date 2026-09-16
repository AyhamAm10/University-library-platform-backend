import { TenantService } from "../tenant.service";
import { FeatureType, SubscriptionStatus, RequestStatus } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { prisma } from "../../config/prisma";
import { BadRequestError } from "../../common/errors/http.error";

export interface GroupedSubjectItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  departmentName?: string | null;
  isSubscribed: boolean;
  hasPendingRequest: boolean;
  pendingRequestId: string | null;
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

  async getGroupedContent(featureType: FeatureType): Promise<GroupedContentResponse> {
    if (!this.timePeriodId) {
      return { featureType, subscribed: [], unsubscribed: [] };
    }

    const studentId = this.tenantContext.role === "STUDENT" ? this.tenantContext.userId : null;

    let studentBranchId: string | null = null;
    let studentDepartmentId: string | null = null;

    if (studentId) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { branchId: true, departmentId: true },
      });
      if (student) {
        studentBranchId = student.branchId;
        studentDepartmentId = student.departmentId;
      }
    }

    // Find subjects relevant to this student's branch/department (or all in library if admin)
    const subjectWhere: any = {
      libraryId: this.libraryId,
      isActive: true,
    };

    if (studentId) {
      const orConditions: any[] = [];
      if (studentDepartmentId) {
        orConditions.push({ departmentId: studentDepartmentId });
      }
      if (studentBranchId) {
        orConditions.push({ branchId: studentBranchId });
      }
      // General subjects with no branch/department
      orConditions.push({ branchId: null, departmentId: null });

      if (orConditions.length > 0) {
        subjectWhere.OR = orConditions;
      }
    }

    const subjects = await prisma.subject.findMany({
      where: subjectWhere,
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    if (subjects.length === 0) {
      return { featureType, subscribed: [], unsubscribed: [] };
    }

    const subjectIds = subjects.map((s) => s.id);

    // Fetch active subscriptions for this student and featureType in current period
    let activeSubscriptions: any[] = [];
    let pendingRequests: any[] = [];

    if (studentId) {
      [activeSubscriptions, pendingRequests] = await Promise.all([
        prisma.subscription.findMany({
          where: {
            libraryId: this.libraryId,
            timePeriodId: this.timePeriodId,
            studentId,
            featureType,
            status: SubscriptionStatus.ACTIVE,
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
      ]);
    }

    // Build lookup maps for fast access
    // Active subscribed subject IDs (whole subject subscription)
    const activeSubscribedSubjectIds = new Set(
      activeSubscriptions.filter((s) => !s.materialId).map((s) => s.subjectId)
    );
    // Active subscribed material IDs (item-specific subscription)
    const activeSubscribedMaterialIds = new Set(
      activeSubscriptions.filter((s) => Boolean(s.materialId)).map((s) => s.materialId)
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
      const isSubscribedToSubject = activeSubscribedSubjectIds.has(sub.id);
      const hasPendingReq = pendingSubjectRequestMap.has(sub.id);
      const pendingReqId = pendingSubjectRequestMap.get(sub.id) || null;

      if (!studentId) {
        // For admin: put all into subscribed list with all items
        subscribed.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          departmentName: sub.department?.name || null,
          isSubscribed: true,
          hasPendingRequest: false,
          pendingRequestId: null,
          items: subjectItems,
        });
        continue;
      }

      // If user is subscribed to the entire subject
      if (isSubscribedToSubject) {
        subscribed.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          departmentName: sub.department?.name || null,
          isSubscribed: true,
          hasPendingRequest: false,
          pendingRequestId: null,
          items: subjectItems,
        });
      } else {
        // Check if there are material-specific subscriptions within this subject (for GOLD, SUMMARIES, QUESTIONS)
        const subscribedMaterials = subjectItems.filter((item) =>
          activeSubscribedMaterialIds.has(item.id)
        );
        const unsubscribedMaterials = subjectItems.filter(
          (item) => !activeSubscribedMaterialIds.has(item.id)
        );

        if (subscribedMaterials.length > 0) {
          subscribed.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectCode: sub.code,
            departmentName: sub.department?.name || null,
            isSubscribed: true,
            hasPendingRequest: false,
            pendingRequestId: null,
            items: subscribedMaterials,
          });
        }

        // The subject itself or remaining items belong to unsubscribed
        // For unsubscribed items, sanitize secure file ids so unauthorized downloads are prevented
        const sanitizedUnsubscribedItems = unsubscribedMaterials.map((item) => ({
          ...item,
          fileId: null, // Don't expose fileId for unsubscribed items
          file: item.file ? { originalName: item.file.originalName, size: item.file.size } : null,
          hasPendingRequest: pendingMaterialRequestMap.has(item.id) || hasPendingReq,
          pendingRequestId: pendingMaterialRequestMap.get(item.id) || pendingReqId,
        }));

        unsubscribed.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          departmentName: sub.department?.name || null,
          isSubscribed: false,
          hasPendingRequest: hasPendingReq,
          pendingRequestId: pendingReqId,
          items: sanitizedUnsubscribedItems,
        });
      }
    }

    return {
      featureType,
      subscribed,
      unsubscribed,
    };
  }
}
