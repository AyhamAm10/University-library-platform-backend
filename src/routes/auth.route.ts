import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authRateLimiter } from "../middlewares/rate-limit.middleware";

export const authRouter = Router();
const controller = new AuthController();

authRouter.post("/login", authRateLimiter, (req, res, next) => {
  controller.login(req, res, next);
});

authRouter.get("/me", authMiddleware, (req, res, next) => {
  controller.getMe(req, res, next);
});

authRouter.post("/logout", authMiddleware, (req, res, next) => {
  controller.logout(req, res, next);
});
