import { Router } from "express";
import { GoldController } from "../controllers/gold.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const goldRouter = Router();
const controller = new GoldController();

goldRouter.use(authMiddleware, tenantMiddleware);

goldRouter.get("/", (req, res, next) => {
  controller.getGoldMaterials(req, res, next);
});

goldRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createGoldMaterial(req, res, next);
});

goldRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateGoldMaterial(req, res, next);
});
