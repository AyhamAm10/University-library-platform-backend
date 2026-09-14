import * as yup from "yup";

export const CreateTimePeriodSchema = yup.object({
  name: yup.string().required("اسم الفترة الزمنية مطلوب"),
  startDate: yup.string().required("تاريخ البداية مطلوب"),
  endDate: yup.string().optional().nullable(),
  activateNow: yup.boolean().optional().default(true),
});

export type CreateTimePeriodDto = yup.InferType<typeof CreateTimePeriodSchema>;

export const UpdateTimePeriodSchema = yup.object({
  name: yup.string().optional(),
  startDate: yup.string().optional(),
  endDate: yup.string().optional().nullable(),
});

export type UpdateTimePeriodDto = yup.InferType<typeof UpdateTimePeriodSchema>;

export const CopyContentSchema = yup.object({
  contentType: yup
    .string()
    .oneOf(["LECTURE", "GOLD", "SUMMARY", "COURSE", "QUESTION"], "نوع المحتوى غير صالح")
    .required("نوع المحتوى مطلوب"),
  sourceContentId: yup.string().required("معرف المحتوى المصدر مطلوب"),
  targetSubjectId: yup.string().optional(),
});

export type CopyContentDto = yup.InferType<typeof CopyContentSchema>;

export const CleanPeriodSchema = yup.object({
  confirmation: yup.string().oneOf(["CONFIRM_DELETE"], "يرجى تأكيد الحذف بكتابة CONFIRM_DELETE").required("التأكيد مطلوب"),
});

export type CleanPeriodDto = yup.InferType<typeof CleanPeriodSchema>;
