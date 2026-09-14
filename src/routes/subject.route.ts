import { Router } from "express";
import { SubjectController } from "../controllers/subject.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const subjectRouter = Router();
const controller = new SubjectController();

subjectRouter.use(authMiddleware, tenantMiddleware);

subjectRouter.get("/", (req, res, next) => {
  controller.getSubjects(req, res, next);
});

subjectRouter.get("/:id", (req, res, next) => {
  controller.getSubjectDetails(req, res, next);
});

subjectRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createSubject(req, res, next);
});

subjectRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateSubject(req, res, next);
});
