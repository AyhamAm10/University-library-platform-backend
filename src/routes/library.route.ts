import { Router } from "express";
import { LibraryController } from "../controllers/library.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { UserRole } from "@prisma/client";

export const libraryRouter = Router();
const controller = new LibraryController();

// Super Admin platform routes
libraryRouter.use(authMiddleware);

libraryRouter.get("/stats", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.getPlatformStats(req, res, next);
});

libraryRouter.post("/", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.createLibrary(req, res, next);
});

libraryRouter.get("/", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.getAllLibraries(req, res, next);
});

libraryRouter.get("/:id", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.getLibraryDetails(req, res, next);
});

libraryRouter.put("/:id", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.updateLibrary(req, res, next);
});

libraryRouter.patch("/:id/toggle-status", checkRole([UserRole.SUPER_ADMIN]), (req, res, next) => {
  controller.toggleStatus(req, res, next);
});
