import * as yup from "yup";

export const CreateQuestionSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  questionText: yup.string().required("نص السؤال مطلوب"),
  questionType: yup
    .string()
    .oneOf(["MULTIPLE_CHOICE", "TRUE_FALSE"], "نوع السؤال غير صالح")
    .default("MULTIPLE_CHOICE"),
  options: yup.array().of(yup.string().required()).min(2, "يجب إدخال خيارين على الأقل").required("خيارات الإجابة مطلوبة"),
  correctAnswer: yup.string().required("الإجابة الصحيحة مطلوبة"),
  explanation: yup.string().optional().nullable(),
  difficulty: yup.string().oneOf(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

export type CreateQuestionDto = yup.InferType<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = yup.object({
  questionText: yup.string().optional(),
  questionType: yup.string().oneOf(["MULTIPLE_CHOICE", "TRUE_FALSE"]).optional(),
  options: yup.array().of(yup.string().required()).min(2).optional(),
  correctAnswer: yup.string().optional(),
  explanation: yup.string().optional().nullable(),
  difficulty: yup.string().oneOf(["EASY", "MEDIUM", "HARD"]).optional(),
});

export type UpdateQuestionDto = yup.InferType<typeof UpdateQuestionSchema>;
