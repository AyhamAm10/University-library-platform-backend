import { TenantService } from "../tenant.service";
import { NotificationRecipient } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";

/**
 * صندوق وارد الطالب: قراءة الإشعارات وحالة القراءة (معزول تلقائياً حسب المكتبة).
 */
export class NotificationRecipientService extends TenantService<NotificationRecipient> {
  constructor(tenantContext: TenantContext) {
    super("notificationRecipient", "notification", tenantContext, false);
  }

  async getInbox(studentId: string, options: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const result = await this.getAllWithPagination({
      where: { studentId, ...(options.unreadOnly ? { readAt: null } : {}) },
      include: {
        notification: {
          select: { id: true, category: true, title: true, message: true, data: true, createdAt: true },
        },
      },
      page: options.page,
      limit: options.limit,
      orderBy: { createdAt: "desc" },
    });

    return {
      ...result,
      data: result.data.map((row: any) => ({
        id: row.notification.id,
        category: row.notification.category,
        title: row.notification.title,
        message: row.notification.message,
        data: row.notification.data,
        createdAt: row.notification.createdAt,
        isRead: row.readAt !== null,
        readAt: row.readAt,
      })),
    };
  }

  async countUnread(studentId: string): Promise<number> {
    return await this.count({ studentId, readAt: null });
  }

  async markRead(studentId: string, notificationId: string) {
    return await this.updateMany({ studentId, notificationId, readAt: null }, { readAt: new Date() });
  }

  async markAllRead(studentId: string) {
    return await this.updateMany({ studentId, readAt: null }, { readAt: new Date() });
  }
}
