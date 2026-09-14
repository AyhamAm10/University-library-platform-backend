import { Router } from "express";
import { SummaryController } from "../controllers/summary.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const summaryRouter = Router();
const controller = new SummaryController();

summaryRouter.use(authMiddleware, tenantMiddleware);

summaryRouter.get("/", (req, res, next) => {
  controller.getSummaryMaterials(req, res, next);
});

summaryRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createSummaryMaterial(req, res, next);
});

summaryRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateSummaryMaterial(req, res, next);
});
