import { RepoService } from "../repo.service";
import { CourseLesson } from "@prisma/client";
import { AddCourseLessonDto } from "../../dto/course.dto";

export class CourseLessonService extends RepoService<CourseLesson> {
  constructor() {
    super("courseLesson", "courseLesson");
  }

  async createLesson(courseId: string, dto: AddCourseLessonDto): Promise<CourseLesson> {
    return await this.create({
      courseId,
      title: dto.title.trim(),
      videoUrl: dto.videoUrl?.trim() || null,
      duration: dto.duration?.trim() || null,
      orderIndex: dto.orderIndex ?? 0,
    });
  }

  async copyLessons(lessons: CourseLesson[], newCourseId: string): Promise<void> {
    if (!lessons || lessons.length === 0) return;
    await this.createMany(
      lessons.map((lesson) => ({
        courseId: newCourseId,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        orderIndex: lesson.orderIndex,
      }))
    );
  }

  async deleteLessonsByCourseId(courseId: string): Promise<void> {
    await this.deleteMany({ courseId });
  }
}
