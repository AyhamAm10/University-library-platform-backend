import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const branchRouter = Router();
const controller = new BranchController();

branchRouter.use(authMiddleware, tenantMiddleware);

branchRouter.get("/", (req, res, next) => {
  controller.getBranches(req, res, next);
});

branchRouter.post("/", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createBranch(req, res, next);
});

branchRouter.put("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateBranch(req, res, next);
});

branchRouter.delete("/:id", checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.deleteBranch(req, res, next);
});

// Academic Years sub-routes for branch
import { AcademicYearController } from "../controllers/academic-year.controller";
const academicYearController = new AcademicYearController();

branchRouter.get("/:branchId/academic-years", (req, res, next) => {
  academicYearController.getAcademicYearsForBranch(req, res, next);
});

branchRouter.post(
  "/:branchId/academic-years",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    academicYearController.createAcademicYearForBranch(req, res, next);
  }
);
