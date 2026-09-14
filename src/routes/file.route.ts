import { Router } from "express";
import { FileController } from "../controllers/file.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";

export const fileRouter = Router();
const controller = new FileController();

fileRouter.use(authMiddleware, tenantMiddleware);

fileRouter.get("/:fileId/metadata", (req, res, next) => {
  controller.getFileMetadata(req, res, next);
});

fileRouter.get("/:fileId", (req, res, next) => {
  controller.streamPdf(req, res, next);
});
