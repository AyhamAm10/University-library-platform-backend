import * as yup from "yup";

export const CreateComplaintSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required("عنوان الشكوى مطلوب")
    .min(3, "عنوان الشكوى يجب أن يكون 3 أحرف على الأقل")
    .max(150, "عنوان الشكوى يجب ألا يتجاوز 150 حرفاً"),
  description: yup
    .string()
    .trim()
    .required("تفاصيل ووصف الشكوى مطلوبة")
    .min(5, "يرجى كتابة تفاصيل واضحة للشكوى (5 أحرف على الأقل)")
    .max(3000, "وصف الشكوى يجب ألا يتجاوز 3000 حرف"),
});

export type CreateComplaintDto = yup.InferType<typeof CreateComplaintSchema>;

export const UpdateComplaintStatusSchema = yup.object({
  status: yup
    .string()
    .oneOf(
      ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"],
      "حالة الشكوى غير صالحة"
    )
    .required("حالة الشكوى مطلوبة"),
  reply: yup
    .string()
    .trim()
    .optional()
    .nullable()
    .max(3000, "رد الإدارة يجب ألا يتجاوز 3000 حرف"),
});

export type UpdateComplaintStatusDto = yup.InferType<typeof UpdateComplaintStatusSchema>;
