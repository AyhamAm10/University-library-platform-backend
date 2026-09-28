import { TenantService } from "../tenant.service";
import { Complaint, ComplaintStatus } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateComplaintDto, UpdateComplaintStatusDto } from "../../dto/complaint.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { StudentService } from "./student.service";
import { NotificationService } from "./notification.service";

export class ComplaintService extends TenantService<Complaint> {
  private _studentService?: StudentService;
  private _notificationService?: NotificationService;

  constructor(tenantContext: TenantContext) {
    super("complaint", "complaint", tenantContext, false);
  }

  protected get studentService(): StudentService {
    if (!this._studentService) {
      this._studentService = new StudentService(this.tenantContext);
    }
    return this._studentService;
  }

  protected get notificationService(): NotificationService {
    if (!this._notificationService) {
      this._notificationService = new NotificationService(this.tenantContext);
    }
    return this._notificationService;
  }

  async createComplaint(studentId: string, dto: CreateComplaintDto) {
    const student = await this.studentService.findById(studentId);
    Ensure.exists(student, "student", "الطالب غير موجود في هذه المكتبة");

    const complaint = await this.create({
      studentId,
      title: dto.title.trim(),
      description: dto.description.trim(),
      status: ComplaintStatus.PENDING,
    });

    return complaint;
  }

  async fetchComplaints(options: {
    studentId?: string;
    status?: ComplaintStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (options.studentId) {
      where.studentId = options.studentId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { student: { fullName: { contains: term, mode: "insensitive" } } },
        { student: { phone: { contains: term, mode: "insensitive" } } },
        { student: { studentCode: { contains: term, mode: "insensitive" } } },
      ];
    }

    return await this.getAllWithPagination({
      where,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentCode: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      page: options.page,
      limit: options.limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async getComplaintById(id: string) {
    const complaint = await this.getById(id, {
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentCode: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    Ensure.exists(complaint, "complaint", "الشكوى غير موجودة");
    return complaint;
  }

  async updateComplaintStatus(id: string, dto: UpdateComplaintStatusDto) {
    const existing = await this.getById(id);
    Ensure.exists(existing, "complaint", "الشكوى غير موجودة");

    const updated = await this.update(id, {
      status: dto.status as ComplaintStatus,
      reply: dto.reply !== undefined ? dto.reply : existing!.reply,
    });

    // Notify student if applicable
    if (existing!.studentId) {
      try {
        let statusText = "قيد المعالجة";
        if (dto.status === "RESOLVED") statusText = "تم حلها بنجاح";
        else if (dto.status === "REJECTED") statusText = "مرفوضة";
        else if (dto.status === "PENDING") statusText = "قيد الانتظار";

        let message = `تم تحديث حالة شكواك (${existing!.title}) إلى: ${statusText}.`;
        if (dto.reply) {
          message += ` رد الإدارة: ${dto.reply}`;
        }

        await this.notificationService.create({
          studentId: existing!.studentId,
          title: "تحديث بخصوص الشكوى",
          message,
          type: "COMPLAINT",
        });
      } catch (err) {
        // Notification logging should not block status update
        console.error("Failed to send complaint notification:", err);
      }
    }

    return updated;
  }

  async deleteComplaint(id: string) {
    const existing = await this.getById(id);
    Ensure.exists(existing, "complaint", "الشكوى غير موجودة");
    await this.delete(id);
    return { success: true };
  }
}
