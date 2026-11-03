import { Router } from "express";
import { UserRole } from "@prisma/client";
import { NotificationController } from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";

export const notificationRouter = Router();
const controller = new NotificationController();

notificationRouter.use(authMiddleware, tenantMiddleware);

// Student inbox & device registration
const studentOnly = checkRole(["STUDENT"]);

notificationRouter.get("/me", studentOnly, (req, res, next) => {
  controller.getMyInbox(req, res, next);
});

notificationRouter.get("/me/unread-count", studentOnly, (req, res, next) => {
  controller.getMyUnreadCount(req, res, next);
});

notificationRouter.patch("/me/read-all", studentOnly, (req, res, next) => {
  controller.markAllRead(req, res, next);
});

notificationRouter.patch("/me/:id/read", studentOnly, (req, res, next) => {
  controller.markRead(req, res, next);
});

notificationRouter.post("/push-token", studentOnly, (req, res, next) => {
  controller.registerPushToken(req, res, next);
});

notificationRouter.delete("/push-token", studentOnly, (req, res, next) => {
  controller.unregisterPushToken(req, res, next);
});

// Library admin: sent history & manual announcements
const libraryAdmin = checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]);

notificationRouter.get("/", libraryAdmin, (req, res, next) => {
  controller.listSent(req, res, next);
});

notificationRouter.post("/", libraryAdmin, (req, res, next) => {
  controller.createAnnouncement(req, res, next);
});
