import { Request, Response, NextFunction } from "express";
import { validator } from "../common/errors/validator";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";
import {
  CreateAnnouncementSchema,
  RegisterPushTokenSchema,
  UnregisterPushTokenSchema,
} from "../dto/notification.dto";
import { NotificationService } from "../services/domain/notification.service";
import { NotificationRecipientService } from "../services/domain/notification-recipient.service";
import { PushTokenService } from "../services/domain/push-token.service";
import { UnauthorizedError } from "../common/errors/http.error";

const requireUserId = (req: Request): string => {
  const userId = req.tenant?.userId;
  if (!userId) throw new UnauthorizedError();
  return userId;
};

export class NotificationController {
  // ===== Student inbox =====

  async getMyInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, unreadOnly } = req.query;
      const service = new NotificationRecipientService(req.tenant!);
      const result = await service.getInbox(requireUserId(req), {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        unreadOnly: unreadOnly === "true",
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "الإشعارات", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getMyUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new NotificationRecipientService(req.tenant!);
      const unread = await service.countUnread(requireUserId(req));
      return res.status(HttpStatusCode.OK).json(ApiResponse.success({ unread }, "عدد الإشعارات غير المقروءة"));
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف الإشعار");
      const service = new NotificationRecipientService(req.tenant!);
      await service.markRead(requireUserId(req), id);
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(null, "تم تحديد الإشعار كمقروء"));
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const service = new NotificationRecipientService(req.tenant!);
      const result = await service.markAllRead(requireUserId(req));
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(result, "تم تحديد كل الإشعارات كمقروءة"));
    } catch (error) {
      next(error);
    }
  }

  async registerPushToken(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(RegisterPushTokenSchema, req.body);
      const service = new PushTokenService(req.tenant!);
      await service.register(requireUserId(req), dto);
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(null, "تم تفعيل الإشعارات على هذا الجهاز"));
    } catch (error) {
      next(error);
    }
  }

  async unregisterPushToken(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(UnregisterPushTokenSchema, req.body);
      const service = new PushTokenService(req.tenant!);
      await service.unregister(requireUserId(req), dto.token);
      return res.status(HttpStatusCode.OK).json(ApiResponse.success(null, "تم إيقاف الإشعارات على هذا الجهاز"));
    } catch (error) {
      next(error);
    }
  }

  // ===== Library admin =====

  async listSent(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, category } = req.query;
      const service = new NotificationService(req.tenant!);
      const result = await service.listSent({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        category: category as string,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "سجل الإشعارات", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateAnnouncementSchema, req.body);
      const service = new NotificationService(req.tenant!);
      const result = await service.createAnnouncement(dto, requireUserId(req));

      if (result.recipientsCount === 0) {
        return res
          .status(HttpStatusCode.OK)
          .json(ApiResponse.success(result, "لا يوجد طلاب مفعلون ضمن الفئة المحددة، لم يُرسل الإشعار"));
      }

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(result, `تم إرسال الإشعار إلى ${result.recipientsCount} طالب`));
    } catch (error) {
      next(error);
    }
  }
}
