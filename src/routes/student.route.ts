import { Router } from "express";
import { StudentController } from "../controllers/student.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const studentRouter = Router();
const controller = new StudentController();

studentRouter.use(authMiddleware, tenantMiddleware);

studentRouter.get("/", (req, res, next) => {
  controller.getStudents(req, res, next);
});

studentRouter.get("/:id", (req, res, next) => {
  controller.getStudentDetails(req, res, next);
});

studentRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createStudent(req, res, next);
});

studentRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateStudent(req, res, next);
});

studentRouter.post("/:id/activation-code", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.generateActivationCode(req, res, next);
});

studentRouter.post("/:id/unbind-device", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.unbindDevice(req, res, next);
});
