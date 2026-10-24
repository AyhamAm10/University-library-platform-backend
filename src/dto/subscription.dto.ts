import * as yup from "yup";

export const CreateSubscriptionSchema = yup.object({
  studentId: yup.string().required("معرف الطالب مطلوب"),
  subjectId: yup.string().required("معرف المادة مطلوب"),
  featureType: yup
    .string()
    .oneOf(
      ["LECTURES", "GOLD_PAPERS", "SUMMARIES", "COURSES", "QUESTION_BANK"],
      "نوع الخدمة التعليمية غير صالح"
    )
    .required("نوع الخدمة التعليمية مطلوب"),
  materialId: yup.string().when("featureType", {
    is: (val: string) => val !== "LECTURES",
    then: (schema) => schema.required("معرف العنصر/الملف مطلوب للاشتراك في هذه الخدمة"),
    otherwise: (schema) => schema.optional().nullable(),
  }),
});

export type CreateSubscriptionDto = yup.InferType<typeof CreateSubscriptionSchema>;
