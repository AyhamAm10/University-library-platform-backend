import { TenantService } from "../tenant.service";
import { QuestionBankItem, QuestionType, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateQuestionDto, UpdateQuestionDto } from "../../dto/question-bank.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError, ForbiddenError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";
import { StoredFileService } from "./stored-file.service";
import { FileStorageService } from "../storage/file-storage.service";

export class QuestionBankService extends TenantService<QuestionBankItem> {
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;
  private _storedFileService?: StoredFileService;

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

  protected get storedFileService(): StoredFileService {
    if (!this._storedFileService) {
      this._storedFileService = new StoredFileService(this.tenantContext);
    }
    return this._storedFileService;
  }

  async createQuestion(dto: CreateQuestionDto, file?: Express.Multer.File) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لإضافة السؤال");
    }

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة في هذه المكتبة");

    // Ensure correctAnswer is one of the options if options are provided
    if (dto.options && dto.correctAnswer) {
      if (!dto.options.includes(dto.correctAnswer)) {
        throw new BadRequestError("الإجابة الصحيحة يجب أن تكون متطابقة مع أحد الخيارات المتاحة");
      }
    }

    let fileId: string | null = null;
    if (file) {
      const subjectFolder = FileStorageService.getSubjectFolder(subject!.name, subject!.id);
      const saved = await FileStorageService.savePdfFile(subjectFolder, file.buffer);

      const storedFile = await this.storedFileService.createFileRecord({
        subjectId: dto.subjectId,
        featureType: FeatureType.QUESTION_BANK,
        originalName: file.originalname,
        mimeType: file.mimetype || "application/pdf",
        size: saved.size,
        storageKey: saved.storageKey,
        timePeriodId: this.timePeriodId,
      });

      fileId = storedFile.id;
    }

    return await this.create({
      subjectId: dto.subjectId,
      title: dto.title?.trim() || (file ? file.originalname.replace(/\.[^/.]+$/, "") : null),
      questionText: dto.questionText?.trim() || null,
      questionType: (dto.questionType as QuestionType) || QuestionType.MULTIPLE_CHOICE,
      options: dto.options || null,
      correctAnswer: dto.correctAnswer?.trim() || null,
      explanation: dto.explanation?.trim() || null,
      difficulty: dto.difficulty || "MEDIUM",
      fileId,
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, file?: Express.Multer.File) {
    const existing = await this.getById(id, {
      include: { file: true, subject: true },
    }) as any;
    Ensure.exists(existing, "questionBankItem", "السؤال غير موجود");

    if (dto.options && dto.correctAnswer) {
      if (!dto.options.includes(dto.correctAnswer)) {
        throw new BadRequestError("الإجابة الصحيحة يجب أن تكون متطابقة مع أحد الخيارات المتاحة");
      }
    }

    let newFileId = existing.fileId;
    let oldFileToDelete: { id: string; storageKey: string } | null = null;

    if (file) {
      const subjectFolder = FileStorageService.getSubjectFolder(
        existing.subject.name,
        existing.subject.id
      );
      const saved = await FileStorageService.savePdfFile(subjectFolder, file.buffer);

      const newStoredFile = await this.storedFileService.createFileRecord({
        subjectId: existing.subjectId,
        featureType: FeatureType.QUESTION_BANK,
        originalName: file.originalname,
        mimeType: file.mimetype || "application/pdf",
        size: saved.size,
        storageKey: saved.storageKey,
        timePeriodId: this.timePeriodId,
      });

      newFileId = newStoredFile.id;
      if (existing.file) {
        oldFileToDelete = {
          id: existing.file.id,
          storageKey: existing.file.storageKey,
        };
      }
    }

    const updated = await this.update(id, {
      title: dto.title?.trim(),
      questionText: dto.questionText?.trim(),
      questionType: dto.questionType as QuestionType,
      options: dto.options,
      correctAnswer: dto.correctAnswer?.trim(),
      explanation: dto.explanation?.trim(),
      difficulty: dto.difficulty,
      fileId: newFileId,
    });

    if (oldFileToDelete) {
      await FileStorageService.deletePhysicalFile(oldFileToDelete.storageKey);
      await this.storedFileService.deleteFileRecord(oldFileToDelete.id);
    }

    return updated;
  }

  async deleteQuestion(id: string) {
    const existing = await this.getById(id, {
      include: { file: true },
    }) as any;
    Ensure.exists(existing, "questionBankItem", "السؤال غير موجود");

    await this.delete(id);

    if (existing.file) {
      await FileStorageService.deletePhysicalFile(existing.file.storageKey);
      await this.storedFileService.deleteFileRecord(existing.file.id);
    }

    return { success: true };
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
        file: {
          select: {
            id: true,
            originalName: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
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

    const isCorrect = (question!.correctAnswer || "").trim().toLowerCase() === selectedAnswer.trim().toLowerCase();

    return {
      questionId,
      selectedAnswer,
      isCorrect,
      correctAnswer: question!.correctAnswer,
      explanation: question!.explanation,
    };
  }
}
