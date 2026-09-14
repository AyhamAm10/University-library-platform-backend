import { Router } from "express";
import { QuestionBankController } from "../controllers/question-bank.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { checkRole } from "../middlewares/role.middleware";
import { pdfUploadMiddleware } from "../middlewares/upload.middleware";
import { UserRole } from "@prisma/client";

export const questionBankRouter = Router();
const controller = new QuestionBankController();

questionBankRouter.use(authMiddleware, tenantMiddleware);

questionBankRouter.get("/", (req, res, next) => {
  controller.getQuestions(req, res, next);
});

questionBankRouter.post(
  "/",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  pdfUploadMiddleware,
  (req, res, next) => {
    controller.createQuestion(req, res, next);
  }
);

questionBankRouter.put(
  "/:id",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  pdfUploadMiddleware,
  (req, res, next) => {
    controller.updateQuestion(req, res, next);
  }
);

questionBankRouter.delete(
  "/:id",
  checkRole([UserRole.LIBRARY_ADMIN, UserRole.SUPER_ADMIN]),
  (req, res, next) => {
    controller.deleteQuestion(req, res, next);
  }
);

// Interactive test answer check endpoint
questionBankRouter.post("/:id/verify", (req, res, next) => {
  controller.verifyAnswer(req, res, next);
});
