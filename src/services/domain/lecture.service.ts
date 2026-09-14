import { TenantService } from "../tenant.service";
import { Lecture, FeatureType, SubscriptionStatus } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateLectureDto, UpdateLectureDto } from "../../dto/lecture.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { SubscriptionService } from "./subscription.service";
import { NotificationService } from "./notification.service";
import { StoredFileService } from "./stored-file.service";
import { FileStorageService } from "../storage/file-storage.service";

export class LectureService extends TenantService<Lecture> {
  private _subjectService?: SubjectService;
  private _subscriptionService?: SubscriptionService;
  private _notificationService?: NotificationService;
  private _storedFileService?: StoredFileService;

  constructor(tenantContext: TenantContext) {
    // Lecture is period-scoped: true
    super("lecture", "lecture", tenantContext, true);
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

  protected get notificationService(): NotificationService {
    if (!this._notificationService) {
      this._notificationService = new NotificationService(this.tenantContext);
    }
    return this._notificationService;
  }

  protected get storedFileService(): StoredFileService {
    if (!this._storedFileService) {
      this._storedFileService = new StoredFileService(this.tenantContext);
    }
    return this._storedFileService;
  }

  async createLecture(dto: CreateLectureDto, file?: Express.Multer.File) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لرفع المحاضرة");
    }

    // Verify subject belongs to library via SubjectService
    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject", "المادة الدراسية غير موجودة في هذه المكتبة");

    let fileId: string | null = null;
    if (file) {
      const subjectFolder = FileStorageService.getSubjectFolder(subject!.name, subject!.id);
      const saved = await FileStorageService.savePdfFile(subjectFolder, file.buffer);

      const storedFile = await this.storedFileService.createFileRecord({
        subjectId: dto.subjectId,
        featureType: FeatureType.LECTURES,
        originalName: file.originalname,
        mimeType: file.mimetype || "application/pdf",
        size: saved.size,
        storageKey: saved.storageKey,
        timePeriodId: this.timePeriodId,
      });

      fileId = storedFile.id;
    }

    const lecture = await this.create({
      subjectId: dto.subjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      fileId,
      orderIndex: dto.orderIndex ?? 0,
    });

    // Educational Lecture Subscription behavior:
    // Auto-access: Active subscribers to the lecture service automatically have access to this new lecture.
    // Dispatch notification to all active subscribers of this subject/feature in this period
    const activeSubscribers = await this.subscriptionService.findMany({
      subjectId: dto.subjectId,
      featureType: FeatureType.LECTURES,
      status: SubscriptionStatus.ACTIVE,
    });

    if (activeSubscribers.length > 0) {
      await this.notificationService.createMany(
        activeSubscribers.map((sub: any) => ({
          studentId: sub.studentId,
          title: `محاضرة جديدة: ${dto.title}`,
          message: `تم رفع محاضرة جديدة لمادة ${subject!.name}، أصبحت متوفرة الآن في حسابك مباشرة.`,
          type: "LECTURE_UPLOAD",
        }))
      );
    }

    return {
      lecture,
      notifiedSubscribersCount: activeSubscribers.length,
    };
  }

  async updateLecture(id: string, dto: UpdateLectureDto, file?: Express.Multer.File) {
    const existing = await this.getById(id, {
      include: { file: true, subject: true },
    }) as any;
    Ensure.exists(existing, "lecture", "المحاضرة غير موجودة");

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
        featureType: FeatureType.LECTURES,
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
      description: dto.description?.trim(),
      orderIndex: dto.orderIndex,
      fileId: newFileId,
    });

    // Safely delete old physical file and record after successful update
    if (oldFileToDelete) {
      await FileStorageService.deletePhysicalFile(oldFileToDelete.storageKey);
      await this.storedFileService.deleteFileRecord(oldFileToDelete.id);
    }

    return updated;
  }

  async deleteLecture(id: string) {
    const existing = await this.getById(id, {
      include: { file: true },
    }) as any;
    Ensure.exists(existing, "lecture", "المحاضرة غير موجودة");

    await this.delete(id);

    if (existing.file) {
      await FileStorageService.deletePhysicalFile(existing.file.storageKey);
      await this.storedFileService.deleteFileRecord(existing.file.id);
    }

    return { success: true };
  }

  async fetchLectures(subjectId?: string) {
    const where: any = {};

    // For students: enforce active subscription for FeatureType.LECTURES
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedSubjectIds = await this.subscriptionService.getStudentActiveSubscribedSubjectIds(
        this.tenantContext.userId,
        FeatureType.LECTURES
      );

      // If student has no active subscriptions for lectures, return empty immediately
      if (subscribedSubjectIds.length === 0) {
        return [];
      }

      if (subjectId) {
        if (!subscribedSubjectIds.includes(subjectId)) {
          return [];
        }
        where.subjectId = subjectId;
      } else {
        where.subjectId = { in: subscribedSubjectIds };
      }
    } else if (subjectId) {
      where.subjectId = subjectId;
    }

    return await this.getAll({
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
      orderBy: { orderIndex: "asc" },
    });
  }
}
