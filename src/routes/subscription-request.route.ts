import { Router } from "express";
import { SubscriptionRequestController } from "../controllers/subscription-request.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const subscriptionRequestRouter = Router();
const controller = new SubscriptionRequestController();

subscriptionRequestRouter.use(authMiddleware, tenantMiddleware);

// Students and Admins can view requests (controller enforces student isolation)
subscriptionRequestRouter.get("/", (req, res, next) => {
  controller.getRequests(req, res, next);
});

// Students can submit a subscription request
subscriptionRequestRouter.post("/", (req, res, next) => {
  controller.createRequest(req, res, next);
});

// Admins approve a subscription request
subscriptionRequestRouter.post(
  "/:id/approve",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    controller.approveRequest(req, res, next);
  }
);

// Admins reject a subscription request
subscriptionRequestRouter.post(
  "/:id/reject",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    controller.rejectRequest(req, res, next);
  }
);
