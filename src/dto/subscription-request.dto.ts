import * as yup from "yup";

export const CreateSubscriptionRequestSchema = yup.object({
  studentId: yup.string().optional().nullable(),
  subjectId: yup.string().required("معرف المادة مطلوب"),
  featureType: yup
    .string()
    .oneOf(
      ["LECTURES", "GOLD_PAPERS", "SUMMARIES", "COURSES", "QUESTION_BANK"],
      "نوع الخدمة التعليمية غير صالح"
    )
    .required("نوع الخدمة التعليمية مطلوب"),
  materialId: yup.string().optional().nullable(),
  notes: yup.string().optional().nullable(),
});

export type CreateSubscriptionRequestDto = yup.InferType<typeof CreateSubscriptionRequestSchema>;

export const ReviewSubscriptionRequestSchema = yup.object({
  notes: yup.string().optional().nullable(),
});

export type ReviewSubscriptionRequestDto = yup.InferType<typeof ReviewSubscriptionRequestSchema>;
