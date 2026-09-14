import * as yup from "yup";

export const CreateLectureSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  title: yup.string().required("عنوان المحاضرة مطلوب"),
  description: yup.string().optional().nullable(),
  orderIndex: yup.number().optional().default(0),
});

export type CreateLectureDto = yup.InferType<typeof CreateLectureSchema>;

export const UpdateLectureSchema = yup.object({
  title: yup.string().optional(),
  description: yup.string().optional().nullable(),
  orderIndex: yup.number().optional(),
});

export type UpdateLectureDto = yup.InferType<typeof UpdateLectureSchema>;
