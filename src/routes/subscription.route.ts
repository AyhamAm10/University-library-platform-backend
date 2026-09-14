import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const subscriptionRouter = Router();
const controller = new SubscriptionController();

subscriptionRouter.use(authMiddleware, tenantMiddleware);

subscriptionRouter.get("/", (req, res, next) => {
  controller.getSubscriptions(req, res, next);
});

subscriptionRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createSubscription(req, res, next);
});

subscriptionRouter.patch("/:id/cancel", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.cancelSubscription(req, res, next);
});
