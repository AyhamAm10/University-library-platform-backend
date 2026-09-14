import { Router } from "express";
import { StudentAuthController } from "../controllers/student-auth.controller";
import { studentAuthMiddleware } from "../middlewares/student-auth.middleware";

export const studentAuthRouter = Router();
const controller = new StudentAuthController();

studentAuthRouter.get("/academic-structure", (req, res, next) => {
  controller.getAcademicStructure(req, res, next);
});

studentAuthRouter.post("/register", (req, res, next) => {
  controller.register(req, res, next);
});

studentAuthRouter.post("/login", (req, res, next) => {
  controller.login(req, res, next);
});

studentAuthRouter.post("/activate", (req, res, next) => {
  controller.activate(req, res, next);
});

studentAuthRouter.post("/refresh", (req, res, next) => {
  controller.refresh(req, res, next);
});

studentAuthRouter.get("/me", studentAuthMiddleware, (req, res, next) => {
  controller.getMe(req, res, next);
});

studentAuthRouter.post("/logout", studentAuthMiddleware, (req, res, next) => {
  controller.logout(req, res, next);
});
