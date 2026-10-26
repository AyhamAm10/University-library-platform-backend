import { Router } from "express";
import { AcademicYearController } from "../controllers/academic-year.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const academicYearRouter = Router();
const controller = new AcademicYearController();

academicYearRouter.use(authMiddleware, tenantMiddleware);

academicYearRouter.get("/", (req, res, next) => {
  controller.getAcademicYears(req, res, next);
});

academicYearRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateAcademicYear(req, res, next);
});

academicYearRouter.delete("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.deleteAcademicYear(req, res, next);
});
