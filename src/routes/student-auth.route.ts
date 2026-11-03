import { Router } from "express";
import { StudentAuthController } from "../controllers/student-auth.controller";
import { studentAuthMiddleware } from "../middlewares/student-auth.middleware";
import { authRateLimiter, registerRateLimiter, refreshRateLimiter } from "../middlewares/rate-limit.middleware";

export const studentAuthRouter = Router();
const controller = new StudentAuthController();

studentAuthRouter.get("/academic-structure", (req, res, next) => {
  controller.getAcademicStructure(req, res, next);
});

studentAuthRouter.post("/register", registerRateLimiter, (req, res, next) => {
  controller.register(req, res, next);
});

studentAuthRouter.post("/login", authRateLimiter, (req, res, next) => {
  controller.login(req, res, next);
});

studentAuthRouter.post("/activate", authRateLimiter, (req, res, next) => {
  controller.activate(req, res, next);
});

studentAuthRouter.post("/refresh", refreshRateLimiter, (req, res, next) => {
  controller.refresh(req, res, next);
});

studentAuthRouter.get("/me", studentAuthMiddleware, (req, res, next) => {
  controller.getMe(req, res, next);
});

studentAuthRouter.post("/logout", studentAuthMiddleware, (req, res, next) => {
  controller.logout(req, res, next);
});
