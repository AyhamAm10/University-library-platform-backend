import { Router } from "express";
import { DepartmentController } from "../controllers/department.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const departmentRouter = Router();
const controller = new DepartmentController();

departmentRouter.use(authMiddleware, tenantMiddleware);

departmentRouter.get("/", (req, res, next) => {
  controller.getDepartments(req, res, next);
});

departmentRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createDepartment(req, res, next);
});

departmentRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateDepartment(req, res, next);
});

departmentRouter.delete("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.deleteDepartment(req, res, next);
});
