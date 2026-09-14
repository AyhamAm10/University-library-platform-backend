import * as yup from "yup";

export const CreateQuestionSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  title: yup.string().optional().nullable(),
  questionText: yup.string().optional().nullable(),
  questionType: yup
    .string()
    .oneOf(["MULTIPLE_CHOICE", "TRUE_FALSE"], "نوع السؤال غير صالح")
    .optional()
    .default("MULTIPLE_CHOICE"),
  options: yup.array().of(yup.string().required()).optional().nullable(),
  correctAnswer: yup.string().optional().nullable(),
  explanation: yup.string().optional().nullable(),
  difficulty: yup.string().oneOf(["EASY", "MEDIUM", "HARD"]).optional().default("MEDIUM"),
});

export type CreateQuestionDto = yup.InferType<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = yup.object({
  title: yup.string().optional().nullable(),
  questionText: yup.string().optional().nullable(),
  questionType: yup.string().oneOf(["MULTIPLE_CHOICE", "TRUE_FALSE"]).optional().nullable(),
  options: yup.array().of(yup.string().required()).optional().nullable(),
  correctAnswer: yup.string().optional().nullable(),
  explanation: yup.string().optional().nullable(),
  difficulty: yup.string().oneOf(["EASY", "MEDIUM", "HARD"]).optional().nullable(),
});

export type UpdateQuestionDto = yup.InferType<typeof UpdateQuestionSchema>;
