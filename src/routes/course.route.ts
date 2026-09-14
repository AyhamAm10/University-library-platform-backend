import { Router } from "express";
import { CourseController } from "../controllers/course.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const courseRouter = Router();
const controller = new CourseController();

courseRouter.use(authMiddleware, tenantMiddleware);

courseRouter.get("/", (req, res, next) => {
  controller.getCourses(req, res, next);
});

courseRouter.get("/:id", (req, res, next) => {
  controller.getCourseDetails(req, res, next);
});

courseRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createCourse(req, res, next);
});

courseRouter.post("/:id/lessons", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.addLesson(req, res, next);
});
