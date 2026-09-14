import { TenantService } from "../tenant.service";
import { QuestionBankItem, QuestionType, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateQuestionDto, UpdateQuestionDto } from "../../dto/question-bank.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError, ForbiddenError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";

export class QuestionBankService extends TenantService<QuestionBankItem> {
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;

  constructor(tenantContext: TenantContext) {
    super("questionBankItem", "questionBankItem", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(this.tenantContext);
    }
    return this._subscriptionService;
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
      title: dto.title?.trim() || null,
      questionText: dto.questionText.trim(),
      questionType: dto.questionType as QuestionType,
      options: dto.options,
      correctAnswer: dto.correctAnswer.trim(),
      explanation: dto.explanation?.trim() || null,
      difficulty: dto.difficulty || "MEDIUM",
      fileUrl: dto.fileUrl?.trim() || null,
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    if (dto.options && dto.correctAnswer) {
      if (!dto.options.includes(dto.correctAnswer)) {
        throw new BadRequestError("الإجابة الصحيحة يجب أن تكون متطابقة مع أحد الخيارات المتاحة");
      }
    }

    return await this.update(id, {
      title: dto.title?.trim(),
      questionText: dto.questionText?.trim(),
      questionType: dto.questionType as QuestionType,
      options: dto.options,
      correctAnswer: dto.correctAnswer?.trim(),
      explanation: dto.explanation?.trim(),
      difficulty: dto.difficulty,
      fileUrl: dto.fileUrl?.trim(),
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

    // For students: enforce active subscription per specific question item!
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedMaterialIds = await this.subscriptionService.getStudentActiveSubscribedMaterialIds(
        this.tenantContext.userId,
        FeatureType.QUESTION_BANK,
        options?.subjectId
      );

      // If student has no active subscriptions for question bank, return empty pagination immediately
      if (subscribedMaterialIds.length === 0) {
        return {
          data: [],
          total: 0,
          page: options?.page || 1,
          limit: options?.limit || 10,
          totalPages: 0,
        };
      }

      where.id = { in: subscribedMaterialIds };
    } else if (options?.subjectId) {
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

    // For students: verify active subscription to this specific question item
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedQuestionIds = await this.subscriptionService.getStudentActiveSubscribedMaterialIds(
        this.tenantContext.userId,
        FeatureType.QUESTION_BANK
      );

      if (!subscribedQuestionIds.includes(questionId)) {
        throw new ForbiddenError("غير مصرح لك بالوصول لهذا السؤال لعدم وجود اشتراك فعال");
      }
    }

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
