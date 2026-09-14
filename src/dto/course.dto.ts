import * as yup from "yup";

export const CreateCourseSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  title: yup.string().required("عنوان الدورة مطلوب"),
  description: yup.string().optional().nullable(),
  thumbnailUrl: yup.string().url("رابط الغلاف غير صالح").optional().nullable(),
});

export type CreateCourseDto = yup.InferType<typeof CreateCourseSchema>;

export const AddCourseLessonSchema = yup.object({
  title: yup.string().required("عنوان الدرس مطلوب"),
  videoUrl: yup.string().url("رابط الفيديو غير صالح").optional().nullable(),
  duration: yup.string().optional().nullable(),
  orderIndex: yup.number().optional().default(0),
});

export type AddCourseLessonDto = yup.InferType<typeof AddCourseLessonSchema>;
