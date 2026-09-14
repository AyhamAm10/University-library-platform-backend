import { Request, Response, NextFunction } from "express";
import { QuestionBankService } from "../services/domain/question-bank.service";
import { validator } from "../common/errors/validator";
import { CreateQuestionSchema, CreateQuestionDto, UpdateQuestionSchema, UpdateQuestionDto } from "../dto/question-bank.dto";
import { ApiResponse } from "../common/responses/api.response";
import { HttpStatusCode } from "../common/errors/api.error";
import { Ensure } from "../common/errors/Ensure.handler";

export class QuestionBankController {
  async createQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await validator(CreateQuestionSchema, req.body);
      const service = new QuestionBankService(req.tenant!);
      const question = await service.createQuestion(dto as CreateQuestionDto);

      return res
        .status(HttpStatusCode.CREATED)
        .json(ApiResponse.success(question, "تمت إضافة السؤال إلى بنك الأسئلة بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async updateQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف السؤال");
      const dto = await validator(UpdateQuestionSchema, req.body);
      const service = new QuestionBankService(req.tenant!);
      const updated = await service.updateQuestion(id, dto as UpdateQuestionDto);

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(updated, "تم تحديث السؤال بنجاح"));
    } catch (error) {
      next(error);
    }
  }

  async getQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { subjectId, questionType, difficulty, page, limit } = req.query;
      const service = new QuestionBankService(req.tenant!);
      const result = await service.fetchQuestions({
        subjectId: subjectId as string,
        questionType: questionType as string,
        difficulty: difficulty as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.status(HttpStatusCode.OK).json(
        ApiResponse.success(result.data, "قائمة أسئلة بنك الأسئلة", {
          count: result.total,
          page: result.page,
          limit: result.limit,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Interactive check answer endpoint
   */
  async verifyAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      Ensure.exists(id, "معرف السؤال");
      const { answer } = req.body;
      Ensure.required(answer, "الإجابة المختارة");

      const service = new QuestionBankService(req.tenant!);
      const verification = await service.verifyAnswer(id, String(answer));

      return res.status(HttpStatusCode.OK).json(ApiResponse.success(verification, "نتيجة التحقق من الإجابة"));
    } catch (error) {
      next(error);
    }
  }
}
