import { Router } from "express";
import { TimePeriodController } from "../controllers/time-period.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const timePeriodRouter = Router();
const controller = new TimePeriodController();

timePeriodRouter.use(authMiddleware, tenantMiddleware);

timePeriodRouter.get("/", (req, res, next) => {
  controller.getPeriods(req, res, next);
});

timePeriodRouter.get("/current", (req, res, next) => {
  controller.getCurrentActivePeriod(req, res, next);
});

timePeriodRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createPeriod(req, res, next);
});

timePeriodRouter.post("/:id/activate", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.activatePeriod(req, res, next);
});

timePeriodRouter.post("/copy-content", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.copyContent(req, res, next);
});

timePeriodRouter.post("/:id/clean", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.cleanPeriod(req, res, next);
});
