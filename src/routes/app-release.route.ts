import { Router } from "express";
import { AppReleaseController } from "../controllers/app-release.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { apkUploadMiddleware } from "../middlewares/apk-upload.middleware";

const router = Router();
const controller = new AppReleaseController();

// 1. Mobile App Endpoints (Public)
router.get("/check", (req, res, next) => controller.checkVersion(req, res, next));
router.get("/download", (req, res, next) => controller.downloadRelease(req, res, next));
router.get("/active", (req, res, next) => controller.getActiveRelease(req, res, next));

// 2. Super Admin Endpoints (Protected)
router.get("/", authMiddleware, checkRole(["SUPER_ADMIN"]), (req, res, next) =>
  controller.getReleasesHistory(req, res, next)
);

router.post(
  "/",
  authMiddleware,
  checkRole(["SUPER_ADMIN"]),
  apkUploadMiddleware,
  (req, res, next) => controller.publishRelease(req, res, next)
);

export default router;
