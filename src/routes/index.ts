import { Router } from "express";
import { authRouter } from "./auth.route";
import { studentAuthRouter } from "./student-auth.route";
import { libraryRouter } from "./library.route";
import { timePeriodRouter } from "./time-period.route";
import { branchRouter } from "./branch.route";
import { departmentRouter } from "./department.route";
import { studentRouter } from "./student.route";
import { subjectRouter } from "./subject.route";
import { lectureRouter } from "./lecture.route";
import { goldRouter } from "./gold.route";
import { summaryRouter } from "./summary.route";
import { courseRouter } from "./course.route";
import { questionBankRouter } from "./question-bank.route";
import { subscriptionRouter } from "./subscription.route";

export const mainRouter = Router();

mainRouter.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

mainRouter.use("/auth", authRouter);
mainRouter.use("/auth/student", studentAuthRouter);
mainRouter.use("/libraries", libraryRouter);
mainRouter.use("/time-periods", timePeriodRouter);
mainRouter.use("/branches", branchRouter);
mainRouter.use("/departments", departmentRouter);
mainRouter.use("/students", studentRouter);
mainRouter.use("/subjects", subjectRouter);
mainRouter.use("/content/lectures", lectureRouter);
mainRouter.use("/content/gold", goldRouter);
mainRouter.use("/content/summaries", summaryRouter);
mainRouter.use("/content/courses", courseRouter);
mainRouter.use("/content/question-bank", questionBankRouter);
mainRouter.use("/subscriptions", subscriptionRouter);
