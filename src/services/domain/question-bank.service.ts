import { TenantService } from "../tenant.service";
import { QuestionBankItem, QuestionType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateQuestionDto, UpdateQuestionDto } from "../../dto/question-bank.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";

export class QuestionBankService extends TenantService<QuestionBankItem> {
  private _subjectService?: SubjectService;

  constructor(tenantContext: TenantContext) {
    super("questionBankItem", "questionBankItem", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  async createQuestion(dto: CreateQuestionDto) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لإضافة السؤال");
    }

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject");

    // Ensure correctAnswer is one of the options
    if (!dto.options.includes(dto.correctAnswer)) {
      throw new BadRequestError("الإجابة الصحيحة يجب أن تكون متطابقة مع أحد الخيارات المتاحة");
    }

    return await this.create({
      subjectId: dto.subjectId,
      questionText: dto.questionText.trim(),
      questionType: dto.questionType as QuestionType,
      options: dto.options,
      correctAnswer: dto.correctAnswer.trim(),
      explanation: dto.explanation?.trim() || null,
      difficulty: dto.difficulty || "MEDIUM",
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    if (dto.options && dto.correctAnswer) {
      if (!dto.options.includes(dto.correctAnswer)) {
        throw new BadRequestError("الإجابة الصحيحة يجب أن تكون متطابقة مع أحد الخيارات المتاحة");
      }
    }

    return await this.update(id, {
      questionText: dto.questionText?.trim(),
      questionType: dto.questionType as QuestionType,
      options: dto.options,
      correctAnswer: dto.correctAnswer?.trim(),
      explanation: dto.explanation?.trim(),
      difficulty: dto.difficulty,
    });
  }

  async fetchQuestions(options?: {
    subjectId?: string;
    questionType?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (options?.subjectId) {
      where.subjectId = options.subjectId;
    }
    if (options?.questionType) {
      where.questionType = options.questionType;
    }
    if (options?.difficulty) {
      where.difficulty = options.difficulty;
    }

    return await this.getAllWithPagination({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      page: options?.page,
      limit: options?.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Interactive test answer check
   */
  async verifyAnswer(questionId: string, selectedAnswer: string) {
    const question = await this.getById(questionId);
    Ensure.exists(question, "question");

    const isCorrect = question!.correctAnswer.trim().toLowerCase() === selectedAnswer.trim().toLowerCase();

    return {
      questionId,
      selectedAnswer,
      isCorrect,
      correctAnswer: question!.correctAnswer,
      explanation: question!.explanation,
    };
  }
}
