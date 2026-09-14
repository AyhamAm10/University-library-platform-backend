import * as yup from "yup";

export const CreateSummaryMaterialSchema = yup.object({
  subjectId: yup.string().required("المادة الدراسية مطلوبة"),
  title: yup.string().required("عنوان الملخص مطلوب"),
  description: yup.string().optional().nullable(),
  fileUrl: yup.string().url("رابط الملف غير صالح").optional().nullable(),
});

export type CreateSummaryMaterialDto = yup.InferType<typeof CreateSummaryMaterialSchema>;

export const UpdateSummaryMaterialSchema = yup.object({
  title: yup.string().optional(),
  description: yup.string().optional().nullable(),
  fileUrl: yup.string().url().optional().nullable(),
});

export type UpdateSummaryMaterialDto = yup.InferType<typeof UpdateSummaryMaterialSchema>;
