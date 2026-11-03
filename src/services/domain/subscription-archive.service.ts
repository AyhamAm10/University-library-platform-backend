import { TenantService } from "../tenant.service";
import { FeatureType, SubscriptionArchive } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";

export class SubscriptionArchiveService extends TenantService<SubscriptionArchive> {
  constructor(tenantContext: TenantContext) {
    // الأرشيف يغطي كل الدورات المغلقة للمكتبة، لذلك لا يُقيّد بالدورة النشطة
    super("subscriptionArchive", "subscriptionArchive", tenantContext, false);
  }

  async fetchArchive(options?: {
    timePeriodId?: string;
    studentId?: string;
    featureType?: string;
    search?: string;
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

    if (options?.featureType) {
      where.featureType = options.featureType as FeatureType;
    }

    const search = options?.search?.trim();
    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: "insensitive" } },
        { studentPhone: { contains: search } },
        { subjectName: { contains: search, mode: "insensitive" } },
        { materialTitle: { contains: search, mode: "insensitive" } },
      ];
    }

    return await this.getAllWithPagination({
      where,
      page: options?.page,
      limit: options?.limit,
      orderBy: [{ archivedAt: "desc" }, { studentName: "asc" }],
    });
  }

  /**
   * قائمة الدورات المؤرشفة مع عدد الاشتراكات في كل منها (لفلتر الأرشيف في اللوحة).
   */
  async getArchivedPeriodsSummary() {
    const groups = await this.model.groupBy({
      by: ["timePeriodId", "timePeriodName"],
      where: this.buildTenantWhere({}),
      _count: { _all: true },
      _max: { archivedAt: true },
      orderBy: { _max: { archivedAt: "desc" } },
    });

    return groups.map((group: any) => ({
      timePeriodId: group.timePeriodId,
      timePeriodName: group.timePeriodName,
      subscriptionsCount: group._count._all,
      archivedAt: group._max.archivedAt,
    }));
  }
}
