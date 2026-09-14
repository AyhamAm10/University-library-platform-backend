import { TenantService } from "../tenant.service";
import { Course, FeatureType } from "@prisma/client";
import { TenantContext } from "../../types/tenant.context";
import { CreateCourseDto, AddCourseLessonDto } from "../../dto/course.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { BadRequestError, ForbiddenError } from "../../common/errors/http.error";
import { SubjectService } from "./subject.service";
import { CourseLessonService } from "./course-lesson.service";
import { SubscriptionService } from "./subscription.service";

export class CourseService extends TenantService<Course> {
  private _subjectService?: SubjectService;
  private _courseLessonService?: CourseLessonService;
  private _subscriptionService?: SubscriptionService;

  constructor(tenantContext: TenantContext) {
    super("course", "course", tenantContext, true);
  }

  protected get subjectService(): SubjectService {
    if (!this._subjectService) {
      this._subjectService = new SubjectService(this.tenantContext);
    }
    return this._subjectService;
  }

  protected get courseLessonService(): CourseLessonService {
    if (!this._courseLessonService) {
      this._courseLessonService = new CourseLessonService();
    }
    return this._courseLessonService;
  }

  protected get subscriptionService(): SubscriptionService {
    if (!this._subscriptionService) {
      this._subscriptionService = new SubscriptionService(this.tenantContext);
    }
    return this._subscriptionService;
  }

  async createCourse(dto: CreateCourseDto) {
    if (!this.timePeriodId) {
      throw new BadRequestError("لا توجد فترة زمنية نشطة محددة لإضافة الدورة");
    }

    const subject = await this.subjectService.findById(dto.subjectId);
    Ensure.exists(subject, "subject");

    return await this.create({
      subjectId: dto.subjectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      thumbnailUrl: dto.thumbnailUrl?.trim() || null,
    });
  }

  async addLessonToCourse(courseId: string, dto: AddCourseLessonDto) {
    const course = await this.findById(courseId);
    Ensure.exists(course, "course");

    return await this.courseLessonService.createLesson(courseId, dto);
  }

  async fetchCourses(subjectId?: string) {
    const where: any = {};

    // For students: enforce active subscription per specific course / material!
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedMaterialIds = await this.subscriptionService.getStudentActiveSubscribedMaterialIds(
        this.tenantContext.userId,
        FeatureType.COURSES,
        subjectId
      );

      // If student has no active subscriptions for courses, return empty immediately
      if (subscribedMaterialIds.length === 0) {
        return [];
      }

      where.id = { in: subscribedMaterialIds };
    } else if (subjectId) {
      where.subjectId = subjectId;
    }

    return await this.getAll({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        lessons: { orderBy: { orderIndex: "asc" } },
        _count: { select: { lessons: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async fetchCourseDetails(id: string) {
    const course = await this.getById(id, {
      include: {
        subject: true,
        lessons: { orderBy: { orderIndex: "asc" } },
      },
    });
    Ensure.exists(course, "course");

    // For students: verify active subscription to this specific course
    if (this.tenantContext.role === "STUDENT" && this.tenantContext.userId) {
      const subscribedCourseIds = await this.subscriptionService.getStudentActiveSubscribedMaterialIds(
        this.tenantContext.userId,
        FeatureType.COURSES
      );

      if (!subscribedCourseIds.includes(id)) {
        throw new ForbiddenError("غير مصرح لك بمشاهدة تفاصيل هذه الدورة لعدم وجود اشتراك فعال");
      }
    }

    return course;
  }

  async getCourseWithLessons(id: string) {
    return await this.findById(id, {
      include: { lessons: true },
    });
  }

  async deleteCoursesForPeriod(periodId: string): Promise<void> {
    const courses = await this.findMany({ timePeriodId: periodId });
    for (const course of courses) {
      await this.courseLessonService.deleteLessonsByCourseId(course.id);
    }
    await this.deleteMany({ timePeriodId: periodId });
  }
}
