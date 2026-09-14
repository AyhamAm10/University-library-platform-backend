import { Router } from "express";
import { LectureController } from "../controllers/lecture.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const lectureRouter = Router();
const controller = new LectureController();

lectureRouter.use(authMiddleware, tenantMiddleware);

lectureRouter.get("/", (req, res, next) => {
  controller.getLectures(req, res, next);
});

lectureRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createLecture(req, res, next);
});

lectureRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateLecture(req, res, next);
});
