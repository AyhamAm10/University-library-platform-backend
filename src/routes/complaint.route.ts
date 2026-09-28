import { Router } from "express";
import { ComplaintController } from "../controllers/complaint.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const complaintRouter = Router();
const controller = new ComplaintController();

complaintRouter.use(authMiddleware, tenantMiddleware);

// List complaints (students view their own; library admins view their library's complaints)
complaintRouter.get("/", (req, res, next) => {
  controller.getComplaints(req, res, next);
});

// Get single complaint details
complaintRouter.get("/:id", (req, res, next) => {
  controller.getComplaintById(req, res, next);
});

// Submit a new complaint (student)
complaintRouter.post("/", (req, res, next) => {
  controller.createComplaint(req, res, next);
});

// Update complaint status & reply (Library admin & Super admin)
complaintRouter.patch(
  "/:id/status",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    controller.updateComplaintStatus(req, res, next);
  }
);

// Delete complaint (Library admin & Super admin)
complaintRouter.delete(
  "/:id",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    controller.deleteComplaint(req, res, next);
  }
);
