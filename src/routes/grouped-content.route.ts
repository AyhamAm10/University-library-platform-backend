import { Router } from "express";
import { GroupedContentController } from "../controllers/grouped-content.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";

export const groupedContentRouter = Router();
const controller = new GroupedContentController();

groupedContentRouter.use(authMiddleware, tenantMiddleware);

groupedContentRouter.get("/", (req, res, next) => {
  controller.getGroupedContent(req, res, next);
});
